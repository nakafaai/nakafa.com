import {
  nakafaScrape,
  nakafaWebSearch,
} from "@repo/ai/agents/research/descriptions";
import { researchPrompt } from "@repo/ai/agents/research/prompt";
import {
  scrapeInputSchema,
  webSearchInputSchema,
} from "@repo/ai/agents/research/schema";
import { scrapeUrl } from "@repo/ai/agents/research/tools/scrape";
import { searchWeb } from "@repo/ai/agents/research/tools/search";
import { model } from "@repo/ai/config/vercel";
import type { ResearchAgentParams } from "@repo/ai/types/agents";
import { generateText, stepCountIs, tool } from "ai";
import { Effect } from "effect";
import * as z from "zod";

/**
 * Runs the research agent and returns text with token usage.
 */
export const runResearchAgent = Effect.fn("research.runResearchAgent")(
  function* ({ task, modelId, locale, context, writer }: ResearchAgentParams) {
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
            execute: ({ query }, { toolCallId }) =>
              Effect.runPromise(searchWeb({ query, toolCallId, writer })),
          }),
          scrape: tool({
            description: nakafaScrape,
            inputSchema: scrapeInputSchema,
            outputSchema: z.string(),
            execute: ({ urlToCrawl }, { toolCallId }) =>
              Effect.runPromise(
                scrapeUrl({ toolCallId, url: urlToCrawl, writer })
              ),
          }),
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
