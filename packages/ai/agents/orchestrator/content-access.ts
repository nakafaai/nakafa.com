import { runContentAccessAgent } from "@repo/ai/agents/content-access";
import type { ContentAccessAgentParams } from "@repo/ai/types/agents";
import { tool } from "ai";
import * as z from "zod";

export const createContentAccessTool = ({
  writer,
  modelId,
  locale,
  context,
}: Omit<ContentAccessAgentParams, "task">) => {
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

      return result;
    },
  });
};
