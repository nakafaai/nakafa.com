import { api } from "@repo/connection/routes";
import { tool } from "ai";
import * as z from "zod";

export const getContentTool = tool({
  description: "Get the content of a page",
  inputSchema: z
    .object({
      slug: z.string().describe("The slug of the content to get."),
    })
    .describe("The slug of the content to get."),
  execute: async ({ slug }) => {
    const { data, error } = await api.contents.getContent({ slug });
    if (error) {
      return {
        slug,
        content: error.message,
      };
    }
    return {
      slug,
      content: data,
    };
  },
});
