import { runResearchAgent } from "@repo/ai/agents/research";
import type {
  ResearchAgentParams,
  UsageAccumulator,
} from "@repo/ai/types/agents";
import { tool } from "ai";
import * as z from "zod";

interface ResearchToolParams extends Omit<ResearchAgentParams, "task"> {
  usageAccumulator: UsageAccumulator;
}

/**
 * Create research tool with usage tracking.
 * Accumulates token usage from sub-agent for total cost calculation.
 * Reference: AI SDK best practice - track sub-agent usage
 */
export const createResearchTool = ({
  writer,
  modelId,
  locale,
  context,
  usageAccumulator,
}: ResearchToolParams) => {
  return tool({
    description:
      "Conduct deep research on any topic by searching the web and analyzing sources. Use this for up-to-date information, general knowledge questions, and external research.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The research question or topic to investigate. IMPORTANT: Include full context such as: what the user is asking about, why they need this information, and any relevant background that would help focus the research."
        ),
    }),
    execute: async ({ query }) => {
      const result = await runResearchAgent({
        task: query,
        writer,
        modelId,
        locale,
        context,
      });

      // Accumulate usage from sub-agent
      usageAccumulator.addUsage(
        "research",
        result.usage.inputTokens ?? 0,
        result.usage.outputTokens ?? 0
      );

      return result.text;
    },
  });
};
