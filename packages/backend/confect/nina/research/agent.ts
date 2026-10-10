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
import { Array as Arr, Effect, MutableHashSet, Result } from "effect";

// Keep exact source fetching within the admitted count and provider concurrency.
const exactSourceScrapeConcurrency = 3;
const exactSourceContentMaxLength = 8000;

/**
 * Runs source-backed research in two provider calls: one writes the web
 * search, one turns the retrieved sources into cited findings. The learner's
 * own links are read first. Once a source is retrieved, a later failure still
 * hands that source to Nina, so the answer never contradicts the cards. The
 * usage handler records each provider call.
 */
export const runResearchAgent = Effect.fn("research.runResearchAgent")(
  function* ({
    userId,
    task,
    modelId,
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
    const { model, timeout } = (yield* Gateway).language({
      purpose: "specialist",
      model: modelId,
    });
    const agent = new Agent(components.nina, {
      name: "research",
      languageModel: model,
      usageHandler,
    });
    const services = yield* Effect.context<never>();
    const runPromise = Effect.runPromiseWith(services);
    const sourceOutputs = yield* scrapeSourceReferences({
      task,
      sourceReferences,
      toolCallId,
      publish,
    });
    let evidence = Arr.map(sourceOutputs, (output) => output.text);
    const eligibleCitationUrls = MutableHashSet.empty<string>();

    for (const sourceOutput of sourceOutputs) {
      addEligibleSourceUrls(eligibleCitationUrls, sourceOutput.sources);
    }

    // True once the search provider answered, with or without sources.
    let searched = false;
    const search = yield* Effect.tryPromise({
      try: (signal) =>
        agent.generateText(
          ctx,
          { userId },
          {
            abortSignal: signal,
            model,
            instructions: researchSearchPrompt({ locale, context }),
            messages: createResearchSearchMessages(task, evidence),
            tools: {
              webSearch: createTool({
                description: nakafaWebSearch,
                inputSchema: webSearchInputSchema,
                outputSchema: textOutputSchema,
                execute: (
                  _context,
                  { queries, sourcePreference },
                  { toolCallId, abortSignal }
                ) =>
                  runPromise(
                    searchWeb({
                      queries,
                      sourcePreference,
                      task,
                      toolCallId,
                      publish,
                    }).pipe(
                      Effect.tap((output) =>
                        Effect.sync(() => {
                          evidence = Arr.append(evidence, output.text);
                          addEligibleSourceUrls(
                            eligibleCitationUrls,
                            output.result.sources
                          );
                          searched = output.result.error === undefined;
                        })
                      ),
                      Effect.map((output) => output.text)
                    ),
                    { signal: abortSignal }
                  ),
              }),
            },
            // The model only writes the queries. The search runs inside this
            // one step, and no second step asks the model for notes.
            toolChoice: { type: "tool", toolName: "webSearch" },
            stopWhen: isStepCount(1),
            timeout,
          }
        ),
      catch: (error) => makeResearchGenerationError(error, "search"),
    }).pipe(Effect.result);

    if (MutableHashSet.size(eligibleCitationUrls) === 0) {
      if (searched) {
        return {
          outcome: "empty" as const,
          text: formatResearchOutput({ findings: [], limitations: [] }),
        };
      }
      return yield* Result.isFailure(search)
        ? search.failure
        : new ResearchGenerationError({
            message: "Research search returned no source.",
            phase: "search",
            rejected: false,
          });
    }
    if (Result.isFailure(search)) {
      yield* logResearchFailure(search.failure);
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
              messages: createResearchSynthesisMessages({ evidence, task }),
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
        text: formatUnsynthesizedEvidence(evidence),
      };
    }

    const output = filterResearchOutputCitations(
      synthesis.success,
      eligibleCitationUrls
    );
    const text = formatResearchOutput(output);
    if (!searched) {
      return { outcome: "partial" as const, text };
    }
    return output.findings.length === 0
      ? { outcome: "empty" as const, text }
      : { text };
  }
);

/**
 * Reads user-provided source references in parallel before broad research.
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
            sources: isSuccessfulScrapeOutput(output)
              ? [{ url: output.data.url }]
              : [],
            text: formatScrapeOutput(output),
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
