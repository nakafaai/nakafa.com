import { google } from "@ai-sdk/google";
import {
  addEligibleCitationUrl,
  addEligibleSourceUrls,
  filterResearchOutputCitations,
} from "@repo/ai/agents/research/citations";
import {
  nakafaScrape,
  nakafaWebSearch,
} from "@repo/ai/agents/research/descriptions";
import { makeResearchGenerationError } from "@repo/ai/agents/research/error";
import {
  createGroundingEvidence,
  createGroundingWebSearchData,
  hasSingleGroundingQuery,
} from "@repo/ai/agents/research/grounding";
import {
  createResearchMessages,
  createResearchSynthesisMessages,
} from "@repo/ai/agents/research/messages";
import { formatResearchOutput } from "@repo/ai/agents/research/output";
import {
  researchEvidencePrompt,
  researchPrompt,
} from "@repo/ai/agents/research/prompt";
import {
  ResearchGenerationError,
  researchOutputSchema,
  scrapeInputSchema,
  webSearchInputSchema,
} from "@repo/ai/agents/research/schema";
import {
  prepareGoogleGroundingStep,
  prepareResearchEvidenceStep,
} from "@repo/ai/agents/research/step";
import {
  formatScrapeOutput,
  isSuccessfulScrapeOutput,
  scrapeUrl,
} from "@repo/ai/agents/research/tools/scrape";
import { searchWeb } from "@repo/ai/agents/research/tools/search";
import { provider } from "@repo/ai/config/app";
import { getFastModelProviderOptions } from "@repo/ai/config/model";
import { gatewayProviderOptions } from "@repo/ai/config/routing";
import { subAgentGenerationTimeout } from "@repo/ai/config/timeouts";
import { getSourceReferences } from "@repo/ai/lib/source";
import { createPrompt } from "@repo/ai/prompt/utils";
import { textOutputSchema } from "@repo/ai/schema/tools";
import type { ResearchAgentParams } from "@repo/ai/types/agents";
import {
  extractJsonMiddleware,
  generateText,
  isStepCount,
  Output,
  tool,
  wrapLanguageModel,
} from "ai";
import { Effect } from "effect";

// Keep exact user source scraping parallel without allowing unlimited fan-out.
const exactSourceScrapeConcurrency = 3;
const exactSourceContentMaxLength = 8000;
const synthesisRetryAttempts = 3;

/**
 * Runs the research agent and returns text with token usage.
 */
export const runResearchAgent = Effect.fn("research.runResearchAgent")(
  function* ({
    task,
    modelId,
    locale,
    context,
    sourceReferences: messageSourceReferences,
    toolCallId,
    writer,
  }: ResearchAgentParams) {
    const services = yield* Effect.context<never>();
    const runPromise = Effect.runPromiseWith(services);
    let triedGoogleGrounding = false;
    const sourceReferences = getUniqueSourceReferences([
      ...messageSourceReferences,
      ...getSourceReferences(task),
    ]);
    const sourceOutputs = yield* scrapeSourceReferences({
      task,
      sourceReferences,
      toolCallId,
      writer,
    });
    const collectedEvidence = sourceOutputs.map((output) => output.text);
    const eligibleCitationUrls = new Set<string>();

    for (const sourceOutput of sourceOutputs) {
      addEligibleSourceUrls(eligibleCitationUrls, sourceOutput.sources);
    }

    const evidenceResult = yield* Effect.tryPromise({
      try: () =>
        generateText({
          model: provider.languageModel(modelId),
          instructions: researchEvidencePrompt({ locale, context }),
          messages: createResearchMessages(task, collectedEvidence),
          tools: {
            google_search: google.tools.googleSearch({
              searchTypes: { webSearch: {} },
            }),
            webSearch: tool({
              description: nakafaWebSearch,
              inputSchema: webSearchInputSchema,
              outputSchema: textOutputSchema,
              execute: ({ queries, sourcePreference }, { toolCallId }) =>
                runPromise(
                  searchWeb({
                    queries,
                    sourcePreference,
                    task,
                    toolCallId,
                    writer,
                  }).pipe(
                    Effect.tap((output) =>
                      Effect.sync(() => {
                        collectedEvidence.push(output.text);
                        addEligibleSourceUrls(
                          eligibleCitationUrls,
                          output.result.sources
                        );
                      })
                    ),
                    Effect.map((output) => output.text)
                  )
                ),
            }),
            scrape: tool({
              description: nakafaScrape,
              inputSchema: scrapeInputSchema,
              outputSchema: textOutputSchema,
              execute: ({ urlToCrawl }, { toolCallId }) =>
                runPromise(
                  scrapeUrl({
                    toolCallId,
                    url: urlToCrawl,
                    writer,
                  }).pipe(
                    Effect.tap((output) =>
                      Effect.sync(() => {
                        const text = formatScrapeOutput(output);
                        collectedEvidence.push(text);

                        if (isSuccessfulScrapeOutput(output)) {
                          addEligibleCitationUrl(
                            eligibleCitationUrls,
                            output.data.url
                          );
                        }
                      })
                    ),
                    Effect.map(formatScrapeOutput)
                  )
                ),
            }),
          },
          /**
           * Reference: AI SDK `prepareStep` supports per-step `toolChoice`,
           * `activeTools`, and message overrides.
           * https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
           */
          prepareStep: ({ messages, steps }) => {
            const hasWebSearchToolCall = steps.some((step) =>
              step.toolCalls.some(
                (toolCall) => toolCall.toolName === "webSearch"
              )
            );
            const evidenceStep = prepareResearchEvidenceStep({
              hasWebSearchToolCall,
            });

            if (evidenceStep) {
              return evidenceStep;
            }

            if (triedGoogleGrounding) {
              return;
            }

            triedGoogleGrounding = true;

            return prepareGoogleGroundingStep(messages);
          },
          providerOptions: {
            gateway: gatewayProviderOptions,
            google: getFastModelProviderOptions(modelId),
          },
          stopWhen: isStepCount(5),
          timeout: subAgentGenerationTimeout,
        }),
      catch: (error) => makeResearchGenerationError(error, "evidence"),
    });

    const groundedSearchData = createGroundingWebSearchData({
      providerMetadata: evidenceResult.finalStep.providerMetadata,
      sources: evidenceResult.sources,
    });

    if (groundedSearchData) {
      const groundingEvidence = createGroundingEvidence(groundedSearchData);

      if (groundingEvidence) {
        collectedEvidence.push(groundingEvidence);
        addEligibleSourceUrls(eligibleCitationUrls, groundedSearchData.sources);
      }
    }

    if (groundedSearchData && hasSingleGroundingQuery(groundedSearchData)) {
      writer.write({
        id: `${toolCallId}-grounding`,
        type: "data-web-search",
        data: groundedSearchData,
      });
    }

    const sourceEvidenceAvailable = eligibleCitationUrls.size > 0;
    const synthesisResult = yield* Effect.tryPromise({
      try: () =>
        generateText({
          model: wrapLanguageModel({
            middleware: extractJsonMiddleware(),
            model: provider.languageModel(modelId),
          }),
          instructions: researchPrompt({ locale, context }),
          messages: createResearchSynthesisMessages({
            collectedEvidence: sourceEvidenceAvailable ? collectedEvidence : [],
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
          providerOptions: {
            gateway: gatewayProviderOptions,
            google: getFastModelProviderOptions(modelId),
          },
          timeout: subAgentGenerationTimeout,
        }),
      catch: (error) => makeResearchGenerationError(error, "synthesis"),
    }).pipe(Effect.retry({ times: synthesisRetryAttempts }));

    const output = synthesisResult.output;

    if (output == null) {
      return yield* new ResearchGenerationError({
        message: "Research agent did not return structured output.",
        phase: "synthesis",
      });
    }
    const evidenceUsage = evidenceResult.usage;
    const synthesisUsage = synthesisResult.usage;

    const filteredOutput = filterResearchOutputCitations(
      output,
      eligibleCitationUrls
    );
    const sourceBacked = filteredOutput.findings.length > 0;

    return {
      sourceBacked,
      text: formatResearchOutput(filteredOutput),
      usage: {
        inputTokens: sumTokens(
          evidenceUsage.inputTokens,
          synthesisUsage.inputTokens
        ),
        inputTokenDetails: {
          cacheReadTokens: sumTokens(
            evidenceUsage.inputTokenDetails?.cacheReadTokens,
            synthesisUsage.inputTokenDetails?.cacheReadTokens
          ),
          cacheWriteTokens: sumTokens(
            evidenceUsage.inputTokenDetails?.cacheWriteTokens,
            synthesisUsage.inputTokenDetails?.cacheWriteTokens
          ),
          noCacheTokens: sumTokens(
            evidenceUsage.inputTokenDetails?.noCacheTokens,
            synthesisUsage.inputTokenDetails?.noCacheTokens
          ),
        },
        outputTokens: sumTokens(
          evidenceUsage.outputTokens,
          synthesisUsage.outputTokens
        ),
        outputTokenDetails: {
          reasoningTokens: sumTokens(
            evidenceUsage.outputTokenDetails?.reasoningTokens,
            synthesisUsage.outputTokenDetails?.reasoningTokens
          ),
          textTokens: sumTokens(
            evidenceUsage.outputTokenDetails?.textTokens,
            synthesisUsage.outputTokenDetails?.textTokens
          ),
        },
        totalTokens: sumTokens(
          evidenceUsage.totalTokens,
          synthesisUsage.totalTokens
        ),
      },
    };
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
    writer,
  }: Pick<
    ResearchAgentParams,
    "task" | "sourceReferences" | "toolCallId" | "writer"
  >) {
    return yield* Effect.forEach(
      sourceReferences,
      (source, index) =>
        scrapeUrl({
          maxLength: exactSourceContentMaxLength,
          selectionQuery: task,
          toolCallId: `${toolCallId}-source-${index + 1}`,
          url: source.href,
          writer,
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
  sourceReferences: ResearchAgentParams["sourceReferences"]
) {
  const seen = new Set<string>();

  return sourceReferences.flatMap((source) => {
    if (seen.has(source.href)) {
      return [];
    }

    seen.add(source.href);
    return [source];
  });
}

/** Adds reported phase usage while preserving the existing zero for missing counts. */
function sumTokens(first: number | undefined, second: number | undefined) {
  return (first ?? 0) + (second ?? 0);
}
