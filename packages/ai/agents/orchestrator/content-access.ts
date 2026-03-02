import { runContentAccessAgent } from "@repo/ai/agents/content-access";
import type {
  ContentAccessAgentParams,
  UsageAccumulator,
} from "@repo/ai/types/agents";
import { tool } from "ai";
import * as z from "zod";

interface ContentAccessToolParams
  extends Omit<ContentAccessAgentParams, "task"> {
  usageAccumulator: UsageAccumulator;
}

/**
 * Create content access tool with usage tracking.
 * Accumulates token usage from sub-agent for total cost calculation.
 * Reference: AI SDK best practice - track sub-agent usage
 */
export const createContentAccessTool = ({
  writer,
  modelId,
  locale,
  context,
  usageAccumulator,
}: ContentAccessToolParams) => {
  return tool({
    description:
      "Access Nakafa educational content including articles, subjects, Quran chapters, and exercises. Use this for retrieving content from the Nakafa platform.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The specific content request or question about Nakafa content. IMPORTANT: Include full context such as: current page URL/slug, whether the page is verified, what specific content the user is asking about, and any relevant details that would help retrieve the right content efficiently."
        ),
    }),
    execute: async ({ query }) => {
      const result = await runContentAccessAgent({
        task: query,
        writer,
        modelId,
        locale,
        context,
      });

      // Accumulate usage from sub-agent
      usageAccumulator.addUsage(
        "contentAccess",
        result.usage.inputTokens ?? 0,
        result.usage.outputTokens ?? 0
      );

      return result.text;
    },
  });
};
