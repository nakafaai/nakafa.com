import { NAKAFA_AGENT_SECTIONS } from "@repo/contents/_lib/agent/constants";
import { LocaleSchema } from "@repo/contents/_types/content";
import * as z from "zod";

/** Runtime schema for public Nakafa sections exposed to agents. */
export const NakafaAgentSectionSchema = z
  .enum(NAKAFA_AGENT_SECTIONS)
  .describe(
    'Public Nakafa content section: "subject" lessons and study materials, "articles" editorial/news content, "exercises" practice questions, or "quran" Quran references.'
  );

/** Runtime schema for a canonical content reference used across agent tools. */
export const NakafaAgentContentRefSchema = z
  .object({
    content_id: z
      .string()
      .describe("Stable content identifier returned by Nakafa MCP search."),
    locale: LocaleSchema.describe("Locale of the referenced content."),
    markdown_url: z
      .url()
      .describe("Canonical markdown URL for focused agent retrieval."),
    route: z
      .string()
      .describe("Locale-free route under the Nakafa content tree."),
    section: NakafaAgentSectionSchema.describe(
      "Top-level Nakafa content section."
    ),
    url: z.url().describe("Canonical public Nakafa URL for citation."),
  })
  .describe("Canonical Nakafa agent content reference.");

/** Runtime schema for one searchable Nakafa content summary. */
export const NakafaAgentContentSummarySchema =
  NakafaAgentContentRefSchema.extend({
    description: z
      .string()
      .describe("Short content description for search results."),
    title: z.string().describe("Human-readable content title."),
  }).describe("Searchable Nakafa content summary.");

export type NakafaAgentSection = z.infer<typeof NakafaAgentSectionSchema>;
export type NakafaAgentContentRef = z.infer<typeof NakafaAgentContentRefSchema>;
export type NakafaAgentContentSummary = z.infer<
  typeof NakafaAgentContentSummarySchema
>;
