import { google } from "@ai-sdk/google";
import { normalizeResearchCitations } from "@repo/ai/agents/research/citation";
import {
  nakafaScrape,
  nakafaWebSearch,
} from "@repo/ai/agents/research/descriptions";
import { createGroundingWebSearchData } from "@repo/ai/agents/research/grounding";
import { researchPrompt } from "@repo/ai/agents/research/prompt";
import {
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
import { generateText, type ModelMessage, stepCountIs, tool } from "ai";
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

    if (sourceReferences.length > 0) {
      return yield* runExactSourceResearch({
        context,
        locale,
        modelId,
        sourceReferences,
        intent,
        toolCallId,
        writer,
      });
    }

    const result = yield* Effect.tryPromise(() =>
      generateText({
        model: model.languageModel(modelId),
        system: researchPrompt({ locale, context }),
        messages: [{ role: "user", content: intent }],
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
      providerMetadata: result.providerMetadata,
      sources: result.sources,
    });

    if (groundedSearchData) {
      writer.write({
        id: `${toolCallId}-grounding`,
        type: "data-web-search",
        data: groundedSearchData,
      });
    }

    return {
      text: normalizeResearchCitations(result.text),
      usage: result.totalUsage,
    };
  }
);

/**
 * Reads exact user sources before asking the model to synthesize findings.
 */
const runExactSourceResearch = Effect.fn("research.runExactSourceResearch")(
  function* ({
    intent,
    modelId,
    locale,
    context,
    sourceReferences,
    toolCallId,
    writer,
  }: ResearchAgentParams) {
    const sourceOutputs = yield* Effect.forEach(
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

    const result = yield* Effect.tryPromise(() =>
      generateText({
        model: model.languageModel(modelId),
        system: researchPrompt({ locale, context, mode: "exact-source" }),
        messages: createExactSourceMessages(intent, sourceOutputs),
        providerOptions: {
          gateway: gatewayProviderOptions,
          google: getModelProviderOptions(modelId),
        },
      })
    );

    return {
      text: normalizeResearchCitations(result.text),
      usage: result.totalUsage,
    };
  }
);

/**
 * Gives the model already-inspected source evidence without exposing research tools.
 */
function createExactSourceMessages(intent: string, sourceOutputs: string[]) {
  return [
    {
      role: "user",
      content: [
        intent,
        "Exact source evidence has already been retrieved. Use only the evidence below for source-specific claims. Do not broaden to search results.",
        "# Exact Source Evidence",
        sourceOutputs.join("\n\n"),
      ].join("\n\n"),
    },
  ] satisfies ModelMessage[];
}

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
