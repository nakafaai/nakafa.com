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
import {
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
import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import { getFastModelProviderOptions } from "@repo/ai/config/models";
import { subAgentGenerationTimeout } from "@repo/ai/config/timeouts";
import { model } from "@repo/ai/config/vercel";
import { getSourceReferences } from "@repo/ai/lib/source";
import { textOutputSchema } from "@repo/ai/schema/tools";
import type { ResearchAgentParams } from "@repo/ai/types/agents";
import {
  extractJsonMiddleware,
  generateText,
  NoObjectGeneratedError,
  Output,
  stepCountIs,
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
          model: model.languageModel(modelId),
          system: researchEvidencePrompt({ locale, context }),
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
                Effect.runPromise(
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
                Effect.runPromise(
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
          stopWhen: stepCountIs(5),
          timeout: subAgentGenerationTimeout,
        }),
      catch: (error) => {
        let cause = JSON.stringify(error);

        if (error instanceof Error) {
          cause = error.message;
        } else if (typeof error === "string") {
          cause = error;
        }

        return new ResearchGenerationError({
          cause,
          message: "Research evidence generation failed.",
          phase: "evidence",
        });
      },
    });

    const groundedSearchData = createGroundingWebSearchData({
      providerMetadata: evidenceResult.providerMetadata,
      sources: evidenceResult.sources,
    });

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
            model: model.languageModel(modelId),
          }),
          system: researchPrompt({ locale, context }),
          messages: createResearchSynthesisMessages({
            collectedEvidence: sourceEvidenceAvailable ? collectedEvidence : [],
            evidence: sourceEvidenceAvailable ? evidenceResult.text : "",
            task,
          }),
          output: Output.object({
            description:
              "Source-backed research findings with citations separated from prose.",
            name: "research_findings",
            schema: researchOutputSchema,
          }),
          providerOptions: {
            gateway: gatewayProviderOptions,
            google: getFastModelProviderOptions(modelId),
          },
          timeout: subAgentGenerationTimeout,
        }),
      catch: (error) => {
        if (NoObjectGeneratedError.isInstance(error)) {
          let cause = JSON.stringify(error.cause);

          if (error.cause instanceof Error) {
            cause = error.cause.message;
          } else if (typeof error.cause === "string") {
            cause = error.cause;
          }

          return new ResearchGenerationError({
            cause,
            message: `Research synthesis generation failed: ${error.message}`,
            phase: "synthesis",
            text: error.text,
          });
        }

        let cause = JSON.stringify(error);

        if (error instanceof Error) {
          cause = error.message;
        } else if (typeof error === "string") {
          cause = error;
        }

        return new ResearchGenerationError({
          cause,
          message: "Research synthesis generation failed.",
          phase: "synthesis",
        });
      },
    }).pipe(Effect.retry({ times: synthesisRetryAttempts }));

    const output = yield* Effect.fromNullable(synthesisResult.output).pipe(
      Effect.mapError(
        () =>
          new ResearchGenerationError({
            message: "Research agent did not return structured output.",
            phase: "synthesis",
          })
      )
    );
    const evidenceUsage = evidenceResult.totalUsage;
    const synthesisUsage = synthesisResult.totalUsage;

    const filteredOutput = filterResearchOutputCitations(
      output,
      eligibleCitationUrls
    );
    const sourceBacked = filteredOutput.findings.length > 0;

    return {
      sourceBacked,
      text: formatResearchOutput(filteredOutput),
      usage: {
        inputTokens:
          (evidenceUsage.inputTokens ?? 0) + (synthesisUsage.inputTokens ?? 0),
        inputTokenDetails: {
          cacheReadTokens:
            (evidenceUsage.inputTokenDetails?.cacheReadTokens ?? 0) +
            (synthesisUsage.inputTokenDetails?.cacheReadTokens ?? 0),
          cacheWriteTokens:
            (evidenceUsage.inputTokenDetails?.cacheWriteTokens ?? 0) +
            (synthesisUsage.inputTokenDetails?.cacheWriteTokens ?? 0),
          noCacheTokens:
            (evidenceUsage.inputTokenDetails?.noCacheTokens ?? 0) +
            (synthesisUsage.inputTokenDetails?.noCacheTokens ?? 0),
        },
        outputTokens:
          (evidenceUsage.outputTokens ?? 0) +
          (synthesisUsage.outputTokens ?? 0),
        outputTokenDetails: {
          reasoningTokens:
            (evidenceUsage.outputTokenDetails?.reasoningTokens ?? 0) +
            (synthesisUsage.outputTokenDetails?.reasoningTokens ?? 0),
          textTokens:
            (evidenceUsage.outputTokenDetails?.textTokens ?? 0) +
            (synthesisUsage.outputTokenDetails?.textTokens ?? 0),
        },
        totalTokens:
          (evidenceUsage.totalTokens ?? 0) + (synthesisUsage.totalTokens ?? 0),
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
