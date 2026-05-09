import {
  nakafaScrape,
  nakafaWebSearch,
} from "@repo/ai/agents/research/descriptions";
import { researchPrompt } from "@repo/ai/agents/research/prompt";
import {
  scrapeInputSchema,
  webSearchInputSchema,
} from "@repo/ai/agents/research/schema";
import {
  prepareScrapeStep,
  selectScrapeUrl,
} from "@repo/ai/agents/research/step";
import { scrapeUrl } from "@repo/ai/agents/research/tools/scrape";
import { searchWeb } from "@repo/ai/agents/research/tools/search";
import { model } from "@repo/ai/config/vercel";
import type { ResearchAgentParams } from "@repo/ai/types/agents";
import { generateText, stepCountIs, tool } from "ai";
import { Effect, Option } from "effect";
import * as z from "zod";

/**
 * Runs the research agent and returns text with token usage.
 */
export const runResearchAgent = Effect.fn("research.runResearchAgent")(
  function* ({ task, modelId, locale, context, writer }: ResearchAgentParams) {
    let pendingScrapeUrl = Option.none<string>();
    const result = yield* Effect.tryPromise(() =>
      generateText({
        model: model.languageModel(modelId),
        system: researchPrompt({ locale, context }),
        messages: [{ role: "user", content: task }],
        tools: {
          webSearch: tool({
            description: nakafaWebSearch,
            inputSchema: webSearchInputSchema,
            outputSchema: z.string(),
            execute: async ({ query }, { toolCallId }) => {
              const output = await Effect.runPromise(
                searchWeb({ query, toolCallId, writer })
              );

              pendingScrapeUrl = selectScrapeUrl(output.result);

              return output.text;
            },
          }),
          scrape: tool({
            description: nakafaScrape,
            inputSchema: scrapeInputSchema,
            outputSchema: z.string(),
            execute: ({ urlToCrawl }, { toolCallId }) => {
              pendingScrapeUrl = Option.none();

              return Effect.runPromise(
                scrapeUrl({ toolCallId, url: urlToCrawl, writer })
              );
            },
          }),
        },
        /**
         * Reference: AI SDK `prepareStep` supports per-step `toolChoice`,
         * `activeTools`, and message overrides.
         * https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling#preparestep-callback
         */
        prepareStep: ({ messages, steps }) => {
          if (Option.isNone(pendingScrapeUrl)) {
            return;
          }

          const hasScrapeToolCall = steps.some((step) =>
            step.toolCalls.some((toolCall) => toolCall.toolName === "scrape")
          );

          if (hasScrapeToolCall) {
            pendingScrapeUrl = Option.none();
          }

          return prepareScrapeStep(
            pendingScrapeUrl,
            messages,
            hasScrapeToolCall
          );
        },
        stopWhen: stepCountIs(3),
      })
    );

    return {
      text: result.text,
      usage: result.totalUsage,
    };
  }
);
