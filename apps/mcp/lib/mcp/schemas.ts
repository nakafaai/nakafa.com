import { NakafaAgentSectionSchema } from "@repo/contents/_lib/agent/schemas";
import { LocaleSchema } from "@repo/contents/_types/content";
import * as z from "zod";

/** Shared tool-error schema used in `structuredContent` for failed calls. */
export const NakafaMcpToolErrorSchema = z
  .object({
    error: z
      .object({
        message: z.string().describe("Actionable error message."),
        suggestions: z
          .array(z.string())
          .min(1)
          .describe("Concrete next steps the agent can try."),
      })
      .describe("Tool execution error details."),
  })
  .describe("Nakafa MCP tool error.");

/** Input schema for `nakafa_search_content`. */
export const NakafaSearchContentInputSchema = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe("Maximum number of summaries to return, from 1 to 50."),
    locale: LocaleSchema.default("en").describe(
      "Content locale: `en` for English or `id` for Indonesian."
    ),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Zero-based pagination offset from a previous `next_offset`."),
    query: z
      .string()
      .trim()
      .optional()
      .describe(
        "Search text matched against IDs, titles, descriptions, and URLs."
      ),
    section: NakafaAgentSectionSchema.optional().describe(
      "Optional section filter: articles, subject, exercises, or quran."
    ),
  })
  .describe("Search arguments for Nakafa public content.");

/** Input schema for `nakafa_get_content`. */
export const NakafaGetContentInputSchema = z
  .object({
    content_id_or_url: z
      .string()
      .min(1)
      .describe(
        "A `content_id` returned by `nakafa_search_content`, a Nakafa URL, or a `nakafa://content/...` resource URI."
      ),
  })
  .describe("Content lookup arguments.");

/** Input schema for `nakafa_get_taxonomy`. */
export const NakafaGetTaxonomyInputSchema = z
  .object({
    locale: LocaleSchema.default("en").describe(
      "Locale used for localized labels and content counts."
    ),
  })
  .describe("Taxonomy lookup arguments.");

/** Input schema for `nakafa_get_exercise`. */
export const NakafaGetExerciseInputSchema = z
  .object({
    content_id_or_url: z
      .string()
      .min(1)
      .describe(
        "An exercise set `content_id`, exercise question `content_id`, Nakafa URL, or `nakafa://content/...` resource URI."
      ),
    exercise_number: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Optional exercise number inside the set."),
  })
  .describe("Exercise lookup arguments.");

/** Input schema for `nakafa_get_quran_reference`. */
export const NakafaGetQuranReferenceInputSchema = z
  .object({
    from_verse: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe("First verse number in the requested range."),
    include_tafsir: z
      .boolean()
      .default(false)
      .describe("Include concise Indonesian tafsir when available."),
    locale: LocaleSchema.default("en").describe(
      "Translation locale: `en` for English or `id` for Indonesian."
    ),
    surah: z.number().int().min(1).max(114).describe("Surah number, 1 to 114."),
    to_verse: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Last verse number in the requested range."),
  })
  .describe("Quran reference lookup arguments.");
