import { google } from "@ai-sdk/google";
import {
  nakafaScrape,
  nakafaWebSearch,
} from "@repo/ai/agents/research/descriptions";
import { createGroundingWebSearchData } from "@repo/ai/agents/research/grounding";
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
  researchOutputSchema,
  scrapeInputSchema,
  webSearchInputSchema,
} from "@repo/ai/agents/research/schema";
import {
  hasUsableWebSearchEvidence,
  prepareGoogleGroundingStep,
  prepareResearchEvidenceStep,
} from "@repo/ai/agents/research/step";
import { scrapeUrl } from "@repo/ai/agents/research/tools/scrape";
import { searchWeb } from "@repo/ai/agents/research/tools/search";
import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import { getModelProviderOptions } from "@repo/ai/config/models";
import { model } from "@repo/ai/config/vercel";
import { getSourceReferences } from "@repo/ai/lib/source";
import { textOutputSchema } from "@repo/ai/schema/tools";
import type { ResearchAgentParams } from "@repo/ai/types/agents";
import { generateText, Output, stepCountIs, tool } from "ai";
import { Effect } from "effect";

// Keep exact user source scraping parallel without allowing unlimited fan-out.
const exactSourceScrapeConcurrency = 3;
const exactSourceContentMaxLength = 8000;

/**
 * Runs the research agent and returns text with token usage.
 */
export const runResearchAgent = Effect.fn("research.runResearchAgent")(
  function* ({
    intent,
    modelId,
    locale,
    context,
    sourceReferences: messageSourceReferences,
    toolCallId,
    writer,
  }: ResearchAgentParams) {
    let needsGoogleGrounding = false;
    let triedGoogleGrounding = false;
    const sourceReferences = getUniqueSourceReferences([
      ...messageSourceReferences,
      ...getSourceReferences(intent),
    ]);
    const sourceOutputs = yield* scrapeSourceReferences({
      intent,
      sourceReferences,
      toolCallId,
      writer,
    });

    const evidenceResult = yield* Effect.tryPromise(() =>
      generateText({
        model: model.languageModel(modelId),
        system: researchEvidencePrompt({ locale, context }),
        messages: createResearchMessages(intent, sourceOutputs),
        tools: {
          google_search: google.tools.googleSearch({
            searchTypes: { webSearch: {} },
          }),
          webSearch: tool({
            description: nakafaWebSearch,
            inputSchema: webSearchInputSchema,
            outputSchema: textOutputSchema,
            execute: ({ queries }, { toolCallId }) =>
              Effect.runPromise(
                searchWeb({ queries, intent, toolCallId, writer }).pipe(
                  Effect.tap((output) =>
                    Effect.sync(() => {
                      needsGoogleGrounding = !hasUsableWebSearchEvidence(
                        output.result
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
                scrapeUrl({ toolCallId, url: urlToCrawl, writer })
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
            step.toolCalls.some((toolCall) => toolCall.toolName === "webSearch")
          );
          const evidenceStep = prepareResearchEvidenceStep({
            hasWebSearchToolCall,
          });

          if (evidenceStep) {
            return evidenceStep;
          }

          if (!needsGoogleGrounding) {
            return;
          }

          if (triedGoogleGrounding) {
            return;
          }

          triedGoogleGrounding = true;

          return prepareGoogleGroundingStep(messages);
        },
        providerOptions: {
          gateway: gatewayProviderOptions,
          google: getModelProviderOptions(modelId),
        },
        stopWhen: stepCountIs(5),
      })
    );

    const groundedSearchData = createGroundingWebSearchData({
      providerMetadata: evidenceResult.providerMetadata,
      sources: evidenceResult.sources,
    });

    if (groundedSearchData) {
      writer.write({
        id: `${toolCallId}-grounding`,
        type: "data-web-search",
        data: groundedSearchData,
      });
    }

    const synthesisResult = yield* Effect.tryPromise(() =>
      generateText({
        model: model.languageModel(modelId),
        system: researchPrompt({ locale, context }),
        messages: createResearchSynthesisMessages({
          evidence: evidenceResult.text,
          intent,
          sourceOutputs,
        }),
        output: Output.object({
          description:
            "Source-backed research findings with citations separated from prose.",
          name: "research_findings",
          schema: researchOutputSchema,
        }),
        providerOptions: {
          gateway: gatewayProviderOptions,
          google: getModelProviderOptions(modelId),
        },
      })
    );

    const output = yield* Effect.fromNullable(synthesisResult.output).pipe(
      Effect.mapError(
        () => new Error("Research agent did not return structured output.")
      )
    );

    return {
      text: formatResearchOutput(output),
      usage: {
        inputTokens:
          (evidenceResult.totalUsage.inputTokens ?? 0) +
          (synthesisResult.totalUsage.inputTokens ?? 0),
        inputTokenDetails: {
          cacheReadTokens:
            (evidenceResult.totalUsage.inputTokenDetails.cacheReadTokens ?? 0) +
            (synthesisResult.totalUsage.inputTokenDetails.cacheReadTokens ?? 0),
          cacheWriteTokens:
            (evidenceResult.totalUsage.inputTokenDetails.cacheWriteTokens ??
              0) +
            (synthesisResult.totalUsage.inputTokenDetails.cacheWriteTokens ??
              0),
          noCacheTokens:
            (evidenceResult.totalUsage.inputTokenDetails.noCacheTokens ?? 0) +
            (synthesisResult.totalUsage.inputTokenDetails.noCacheTokens ?? 0),
        },
        outputTokens:
          (evidenceResult.totalUsage.outputTokens ?? 0) +
          (synthesisResult.totalUsage.outputTokens ?? 0),
        outputTokenDetails: {
          reasoningTokens:
            (evidenceResult.totalUsage.outputTokenDetails.reasoningTokens ??
              0) +
            (synthesisResult.totalUsage.outputTokenDetails.reasoningTokens ??
              0),
          textTokens:
            (evidenceResult.totalUsage.outputTokenDetails.textTokens ?? 0) +
            (synthesisResult.totalUsage.outputTokenDetails.textTokens ?? 0),
        },
        totalTokens:
          (evidenceResult.totalUsage.totalTokens ?? 0) +
          (synthesisResult.totalUsage.totalTokens ?? 0),
      },
    };
  }
);

/**
 * Reads user-provided source references in parallel before broad research.
 */
const scrapeSourceReferences = Effect.fn("research.scrapeSourceReferences")(
  function* ({
    intent,
    sourceReferences,
    toolCallId,
    writer,
  }: Pick<
    ResearchAgentParams,
    "intent" | "sourceReferences" | "toolCallId" | "writer"
  >) {
    return yield* Effect.forEach(
      sourceReferences,
      (source, index) =>
        scrapeUrl({
          maxLength: exactSourceContentMaxLength,
          query: intent,
          toolCallId: `${toolCallId}-source-${index + 1}`,
          url: source.href,
          writer,
        }),
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
