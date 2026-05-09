import { NakafaAgentContentRefSchema } from "@repo/contents/_lib/agent/schema/ref";
import * as z from "zod";

/** Shared content reference input accepted by Nakafa agent lookup tools. */
export const NakafaAgentContentRefInputSchema = z
  .string()
  .min(1)
  .describe(
    "Nakafa content reference: a content_id returned by search, a canonical Nakafa URL, or a nakafa://content/... resource URI."
  );

/** Runtime schema for full content read input. */
export const NakafaAgentReadOptionsSchema = z
  .object({
    content_ref: NakafaAgentContentRefInputSchema,
  })
  .strict()
  .describe("Nakafa content read options.");

/** Runtime schema for markdown retrieval output. */
export const NakafaAgentMarkdownSchema = NakafaAgentContentRefSchema.extend({
  description: z.string().describe("Short content description."),
  text: z.string().describe("Full agent-readable markdown text."),
  title: z.string().describe("Human-readable content title."),
}).describe("Full Nakafa content markdown payload.");

export type NakafaAgentReadOptions = z.infer<
  typeof NakafaAgentReadOptionsSchema
>;
export type NakafaAgentMarkdown = z.infer<typeof NakafaAgentMarkdownSchema>;
