import { Agent, createTool, type UsageHandler } from "@convex-dev/agent";
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
import { makeResearchGenerationError } from "@repo/backend/confect/nina/research/error";
import {
  createResearchMessages,
  createResearchSynthesisMessages,
} from "@repo/backend/confect/nina/research/messages";
import { formatResearchOutput } from "@repo/backend/confect/nina/research/output";
import {
  researchEvidencePrompt,
  researchPrompt,
} from "@repo/backend/confect/nina/research/prompt";
import {
  ResearchSourceLimitError,
  researchMaxSources,
  researchOutputSchema,
  webSearchInputSchema,
} from "@repo/backend/confect/nina/research/schema";
import { getSourceReferences } from "@repo/backend/confect/nina/research/source";
import { prepareResearchEvidenceStep } from "@repo/backend/confect/nina/research/step";
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
import { Array as Arr, Effect, MutableHashSet } from "effect";

// Keep exact source fetching within the admitted count and provider concurrency.
const exactSourceScrapeConcurrency = 3;
const exactSourceContentMaxLength = 8000;
const synthesisRetryAttempts = 3;

/**
 * Runs source-backed research through Agent; its usage handler records provider calls.
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
    let collectedEvidence = Arr.map(sourceOutputs, (output) => output.text);
    const eligibleCitationUrls = MutableHashSet.empty<string>();

    for (const sourceOutput of sourceOutputs) {
      addEligibleSourceUrls(eligibleCitationUrls, sourceOutput.sources);
    }

    const evidenceResult = yield* Effect.tryPromise({
      try: (signal) =>
        agent.generateText(
          ctx,
          { userId },
          {
            abortSignal: signal,
            model,
            instructions: researchEvidencePrompt({ locale, context }),
            messages: createResearchMessages(task, collectedEvidence),
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
                          collectedEvidence = Arr.append(
                            collectedEvidence,
                            output.text
                          );
                          addEligibleSourceUrls(
                            eligibleCitationUrls,
                            output.result.sources
                          );
                        })
                      ),
                      Effect.map((output) => output.text)
                    ),
                    { signal: abortSignal }
                  ),
              }),
            },
            /**
             * Reference: AI SDK `prepareStep` supports per-step `toolChoice`,
             * `activeTools`, and message overrides.
             * https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
             */
            prepareStep: ({ steps }) => {
              const hasWebSearchToolCall = Arr.some(steps, (step) =>
                Arr.some(
                  step.toolCalls,
                  (toolCall) => toolCall.toolName === "webSearch"
                )
              );
              return prepareResearchEvidenceStep({ hasWebSearchToolCall });
            },
            stopWhen: isStepCount(2),
            timeout,
          }
        ),
      catch: (error) => makeResearchGenerationError(error, "evidence"),
    });

    const sourceEvidenceAvailable =
      MutableHashSet.size(eligibleCitationUrls) > 0;
    const output = yield* Effect.tryPromise({
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
                collectedEvidence: sourceEvidenceAvailable
                  ? collectedEvidence
                  : [],
                evidence: sourceEvidenceAvailable ? evidenceResult.text : "",
                task,
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
    }).pipe(Effect.retry({ times: synthesisRetryAttempts }));
    const filteredOutput = filterResearchOutputCitations(
      output,
      eligibleCitationUrls
    );
    return { text: formatResearchOutput(filteredOutput) };
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
