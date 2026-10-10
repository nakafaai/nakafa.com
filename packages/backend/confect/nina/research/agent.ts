import { Agent, createTool, type UsageHandler } from "@convex-dev/agent";
import { researchMaxSources } from "@repo/backend/client/nina/research";
import { components } from "@repo/backend/confect/_generated/components";
import { ActionCtx } from "@repo/backend/confect/_generated/services";
import { Gateway } from "@repo/backend/confect/gateway/handle";
import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import type { ResearchAgentData } from "@repo/backend/confect/nina/contract/agent";
import { textOutputSchema } from "@repo/backend/confect/nina/contract/tools";
import { createPrompt } from "@repo/backend/confect/nina/prompt/assemble";
import {
  addEligibleSourceUrls,
  filterResearchOutputCitations,
} from "@repo/backend/confect/nina/research/citations";
import { nakafaWebSearch } from "@repo/backend/confect/nina/research/descriptions";
import {
  logResearchFailure,
  makeResearchGenerationError,
} from "@repo/backend/confect/nina/research/error";
import {
  createResearchSearchMessages,
  createResearchSynthesisMessages,
} from "@repo/backend/confect/nina/research/messages";
import {
  formatResearchOutput,
  formatUnsynthesizedEvidence,
} from "@repo/backend/confect/nina/research/output";
import {
  researchPrompt,
  researchSearchPrompt,
} from "@repo/backend/confect/nina/research/prompt";
import {
  ResearchGenerationError,
  ResearchSourceLimitError,
  researchOutputSchema,
  webSearchInputSchema,
} from "@repo/backend/confect/nina/research/schema";
import { getSourceReferences } from "@repo/backend/confect/nina/research/source";
import {
  formatScrapeOutput,
  isSuccessfulScrapeOutput,
  scrapeUrl,
} from "@repo/backend/confect/nina/research/tools/scrape";
import { searchWeb } from "@repo/backend/confect/nina/research/tools/search";
import {
  extractJsonMiddleware,
  isStepCount,
  Output,
  wrapLanguageModel,
} from "ai";
import { Array as Arr, Effect, MutableHashSet, Option, Result } from "effect";

// Keep exact source fetching within the admitted count and provider concurrency.
const exactSourceScrapeConcurrency = 3;
const exactSourceContentMaxLength = 8000;

/**
 * Runs source-backed research in two provider calls: one writes the web
 * search, one turns the retrieved sources into cited findings. The learner's
 * own links are read first, and the search itself runs here, under its own
 * deadline, not inside the model step. Once a source is retrieved, a later
 * failure still hands that source to Nina, so the answer never contradicts the
 * cards. The usage handler records each provider call.
 */
export const runResearchAgent = Effect.fn("research.runResearchAgent")(
  function* ({
    userId,
    task,
    locale,
    context,
    sourceReferences: messageSourceReferences,
    toolCallId,
    publish,
    usageHandler,
  }: ResearchAgentData & {
    readonly publish: CapabilityProgress;
    readonly usageHandler: UsageHandler;
  }) {
    const sourceReferences = getUniqueSourceReferences([
      ...messageSourceReferences,
      ...getSourceReferences(task),
    ]);
    if (sourceReferences.length > researchMaxSources) {
      return yield* new ResearchSourceLimitError({
        maximum: researchMaxSources,
        received: sourceReferences.length,
      });
    }
    const ctx = yield* ActionCtx;
    const { model, timeout } = (yield* Gateway).language("specialist");
    const agent = new Agent(components.nina, {
      name: "research",
      languageModel: model,
      usageHandler,
    });
    const sources = yield* scrapeSourceReferences({
      task,
      sourceReferences,
      toolCallId,
      publish,
    });
    const read = Arr.filter(sources, (source) => source.read);
    const unreadUrls = Arr.flatMap(sources, (source) =>
      source.read ? [] : [source.url]
    );
    const readEvidence = Arr.map(read, (source) => source.text);

    // The model only writes the queries. The tool does nothing itself, so the
    // one step ends with its call and the search below owns its own deadline.
    const planned = yield* Effect.tryPromise({
      try: (signal) =>
        agent.generateText(
          ctx,
          { userId },
          {
            abortSignal: signal,
            model,
            instructions: researchSearchPrompt({ locale, context }),
            messages: createResearchSearchMessages(task, readEvidence),
            tools: {
              webSearch: createTool({
                description: nakafaWebSearch,
                inputSchema: webSearchInputSchema,
                outputSchema: textOutputSchema,
                execute: () => Promise.resolve("Search planned."),
              }),
            },
            toolChoice: { type: "tool", toolName: "webSearch" },
            stopWhen: isStepCount(1),
            timeout,
          }
        ),
      catch: (error) => makeResearchGenerationError(error, "search"),
    }).pipe(
      Effect.flatMap(({ toolCalls }) =>
        Effect.fromOption(
          Arr.findFirst(toolCalls, (call) =>
            call.dynamic || call.invalid ? Option.none() : Option.some(call)
          )
        )
      ),
      Effect.catchTag("NoSuchElementError", () =>
        Effect.fail(
          new ResearchGenerationError({
            message: "Research search wrote no usable query.",
            phase: "search",
            rejected: true,
          })
        )
      ),
      Effect.result
    );
    const search = Result.isSuccess(planned)
      ? Option.some(
          yield* searchWeb({
            ...planned.success.input,
            task,
            toolCallId: planned.success.toolCallId,
            publish,
          })
        )
      : Option.none();
    // True once the search provider answered, with or without sources.
    const searched = Option.exists(
      search,
      ({ result }) => result.error === undefined
    );
    const found = Option.match(search, {
      onNone: () => [],
      onSome: ({ result }) => result.sources,
    });
    const evidence = Arr.appendAll(
      readEvidence,
      Option.match(
        Option.filter(search, () => found.length > 0),
        {
          onNone: () => [],
          onSome: ({ text }) => [text],
        }
      )
    );
    const eligibleCitationUrls = MutableHashSet.empty<string>();
    addEligibleSourceUrls(eligibleCitationUrls, read);
    addEligibleSourceUrls(eligibleCitationUrls, found);

    if (MutableHashSet.size(eligibleCitationUrls) === 0) {
      if (searched) {
        return {
          outcome: "empty" as const,
          text: formatResearchOutput({ findings: [], limitations: [] }),
        };
      }
      return yield* Result.isFailure(planned)
        ? planned.failure
        : new ResearchGenerationError({
            message: "Research search returned no source.",
            phase: "search",
            rejected: false,
          });
    }
    if (Result.isFailure(planned)) {
      yield* logResearchFailure(planned.failure);
    }

    const synthesis = yield* Effect.tryPromise({
      try: (signal) =>
        agent
          .generateText(
            ctx,
            { userId },
            {
              abortSignal: signal,
              model: wrapLanguageModel({
                middleware: extractJsonMiddleware(),
                model,
              }),
              instructions: researchPrompt({ locale, context }),
              messages: createResearchSynthesisMessages({
                evidence,
                task,
                unread: unreadUrls,
              }),
              output: Output.object({
                description: createPrompt({
                  taskContext: `
                Source-backed research findings with citations separated from prose.
              `,
                }),
                name: "research_findings",
                schema: researchOutputSchema,
              }),
              timeout,
            }
          )
          .then((result) => result.output),
      catch: (error) => makeResearchGenerationError(error, "synthesis"),
    }).pipe(Effect.result);
    if (Result.isFailure(synthesis)) {
      yield* logResearchFailure(synthesis.failure);
      return {
        outcome: "partial" as const,
        text: formatUnsynthesizedEvidence(evidence, unreadUrls),
      };
    }

    const text = formatResearchOutput(
      filterResearchOutputCitations(synthesis.success, eligibleCitationUrls)
    );
    // Sources that support no finding are still sources the learner sees, so
    // such a run is not `empty`; Nina reads what to say in `text`.
    return searched ? { text } : { outcome: "partial" as const, text };
  }
);

/**
 * Reads user-provided source references in parallel before broad research.
 * A source that could not be read keeps its URL and no text: it is never
 * shown to the model as evidence.
 */
const scrapeSourceReferences = Effect.fn("research.scrapeSourceReferences")(
  function* ({
    task,
    sourceReferences,
    toolCallId,
    publish,
  }: Pick<ResearchAgentData, "task" | "sourceReferences" | "toolCallId"> & {
    readonly publish: CapabilityProgress;
  }) {
    return yield* Effect.forEach(
      sourceReferences,
      (source, index) =>
        scrapeUrl({
          maxLength: exactSourceContentMaxLength,
          selectionQuery: task,
          toolCallId: `${toolCallId}-source-${index + 1}`,
          url: source.href,
          publish,
        }).pipe(
          Effect.map((output) => ({
            read: isSuccessfulScrapeOutput(output),
            text: formatScrapeOutput(output),
            url: output.data.url,
          }))
        ),
      { concurrency: exactSourceScrapeConcurrency }
    );
  }
);

/**
 * Keeps source references unique while preserving the user's order.
 */
function getUniqueSourceReferences(
  sourceReferences: ResearchAgentData["sourceReferences"]
) {
  const seen = MutableHashSet.empty<string>();
  return Arr.filter(sourceReferences, (source) => {
    if (MutableHashSet.has(seen, source.href)) {
      return false;
    }
    MutableHashSet.add(seen, source.href);
    return true;
  });
}
