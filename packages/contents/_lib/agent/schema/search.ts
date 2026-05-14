import {
  NAKAFA_AGENT_DEFAULT_LIMIT,
  NAKAFA_AGENT_MAX_LIMIT,
  NAKAFA_AGENT_MAX_OFFSET,
  NAKAFA_AGENT_MAX_QUERIES,
} from "@repo/contents/_lib/agent/constants";
import {
  NakafaAgentContentSummarySchema,
  NakafaAgentSectionSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import * as z from "zod";

/** Runtime schema for content search input. */
export const NakafaAgentSearchOptionsSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(NAKAFA_AGENT_MAX_LIMIT)
      .default(NAKAFA_AGENT_DEFAULT_LIMIT)
      .describe("Maximum number of results to return."),
    locale: LocaleSchema.default(routing.defaultLocale).describe(
      "Locale to search."
    ),
    offset: z
      .number()
      .int()
      .min(0)
      .max(NAKAFA_AGENT_MAX_OFFSET)
      .default(0)
      .describe("Zero-based result offset for pagination."),
    query: z
      .string()
      .trim()
      .optional()
      .describe(
        "Optional query over synced Nakafa title and content text. Keep the user's topic words; do not add section names unless the user used them."
      ),
    queries: z
      .array(z.string().trim().min(1))
      .max(NAKAFA_AGENT_MAX_QUERIES)
      .optional()
      .describe(
        "Optional unique query variants for the same section and locale. Use separate parallel search tool calls when section filters differ."
      ),
    section: NakafaAgentSectionSchema.optional().describe(
      'Optional section filter. Use "subject" for lessons, school materials, class or grade topics, and study content. Use "articles" only when the user explicitly asks for articles, news, essays, analysis, or editorial content. Use "exercises" for questions, drills, tests, tryouts, or answer explanations. Use "quran" for surah, ayah, tafsir, or Quran references. Omit this filter for broad topic discovery.'
    ),
  })
  .describe("Nakafa content search options.");

/** Runtime schema for paginated Nakafa content search output. */
export const NakafaAgentSearchResultSchema = z
  .object({
    count: z.number().int().min(0).describe("Number of returned results."),
    has_more: z.boolean().describe("Whether another page is available."),
    items: z
      .array(NakafaAgentContentSummarySchema)
      .describe("Bounded search result page."),
    limit: z.number().int().min(1).describe("Requested page size."),
    next_offset: z
      .number()
      .int()
      .min(0)
      .nullable()
      .describe("Next offset, or null when there is no next page."),
    offset: z.number().int().min(0).describe("Current result offset."),
  })
  .describe("Paginated Nakafa content search result.");

export type NakafaAgentSearchOptions = z.input<
  typeof NakafaAgentSearchOptionsSchema
>;
export type NakafaAgentSearchInput = z.output<
  typeof NakafaAgentSearchOptionsSchema
>;
export type NakafaAgentSearchResult = z.infer<
  typeof NakafaAgentSearchResultSchema
>;
