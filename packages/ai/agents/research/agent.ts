import { google } from "@ai-sdk/google";
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
  prepareWebSearchStep,
} from "@repo/ai/agents/research/step";
import { scrapeUrl } from "@repo/ai/agents/research/tools/scrape";
import { searchWeb } from "@repo/ai/agents/research/tools/search";
import { gatewayProviderOptions } from "@repo/ai/config/gateway-options";
import { getModelProviderOptions } from "@repo/ai/config/models";
import { model } from "@repo/ai/config/vercel";
import { textOutputSchema } from "@repo/ai/schema/tools";
import type { ResearchAgentParams } from "@repo/ai/types/agents";
import { generateText, stepCountIs, tool } from "ai";
import { Effect } from "effect";

/**
 * Runs the research agent and returns text with token usage.
 */
export const runResearchAgent = Effect.fn("research.runResearchAgent")(
  function* ({
    task,
    modelId,
    locale,
    context,
    toolCallId,
    writer,
  }: ResearchAgentParams) {
    let needsGoogleGrounding = false;
    let triedGoogleGrounding = false;
    const result = yield* Effect.tryPromise(() =>
      generateText({
        model: model.languageModel(modelId),
        system: researchPrompt({ locale, context }),
        messages: [{ role: "user", content: task }],
        tools: {
          google_search: google.tools.googleSearch({
            searchTypes: { webSearch: {} },
          }),
          webSearch: tool({
            description: nakafaWebSearch,
            inputSchema: webSearchInputSchema,
            outputSchema: textOutputSchema,
            execute: ({ query }, { toolCallId }) =>
              Effect.runPromise(
                searchWeb({ query, toolCallId, writer }).pipe(
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
          const webSearchStep = prepareWebSearchStep(hasWebSearchToolCall);

          if (webSearchStep) {
            return webSearchStep;
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
      query: task,
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
      text: result.text,
      usage: result.totalUsage,
    };
  }
);
