import { runContentAccessAgent } from "@repo/ai/agents/content-access";
import type { ModelId } from "@repo/ai/config/vercel";
import type { MyUIMessage } from "@repo/ai/types/message";
import { tool, type UIMessageStreamWriter } from "ai";
import * as z from "zod";

interface Params {
  locale: string;
  modelId: ModelId;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export const createContentAccessTool = ({
  writer,
  modelId,
  locale,
}: Params) => {
  return tool({
    description:
      "Access Nakafa educational content including articles, subjects, Quran chapters, and exercises. Use this for retrieving content from the Nakafa platform.",
    inputSchema: z.object({
      query: z
        .string()
        .describe(
          "The specific content request or question about Nakafa content"
        ),
    }),
    execute: async ({ query }) => {
      const result = await runContentAccessAgent({
        task: query,
        writer,
        modelId,
        locale,
      });

      return result;
    },
  });
};
