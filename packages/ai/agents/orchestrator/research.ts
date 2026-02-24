import { runResearchAgent } from "@repo/ai/agents/research";
import type { ResearchAgentParams } from "@repo/ai/types/agents";
import { tool } from "ai";
import * as z from "zod";

export const createResearchTool = ({
  writer,
  modelId,
  locale,
  context,
}: Omit<ResearchAgentParams, "task">) => {
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

      return result;
    },
  });
};
