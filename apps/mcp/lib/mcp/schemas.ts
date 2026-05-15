import {
  NAKAFA_AGENT_DEFAULT_LIMIT,
  NAKAFA_AGENT_MAX_LIMIT,
  NAKAFA_AGENT_MAX_OFFSET,
  NAKAFA_AGENT_MAX_QUERIES,
  NAKAFA_AGENT_SECTIONS,
} from "@repo/contents/_lib/agent/constants";
import { routing } from "@repo/internationalization/src/routing";
import * as z from "zod";

const LocaleSchema = z.enum(routing.locales);
const NakafaSectionSchema = z.enum(NAKAFA_AGENT_SECTIONS);
const UrlStringSchema = z.url();

const NakafaContentRefSchema = z.object({
  content_id: z.string().describe("Stable content identifier."),
  locale: LocaleSchema.describe("Locale of the referenced content."),
  markdown_url: UrlStringSchema.describe(
    "Canonical markdown URL for focused agent retrieval."
  ),
  route: z.string().describe("Locale-free route under the content tree."),
  section: NakafaSectionSchema.describe("Top-level Nakafa content section."),
  url: UrlStringSchema.describe("Canonical public Nakafa URL for citation."),
});

const NakafaContentSummarySchema = NakafaContentRefSchema.extend({
  description: z.string().describe("Short content description."),
  title: z.string().describe("Human-readable content title."),
});

/** Shared content reference input accepted by lookup tools. */
export const NakafaMcpContentRefInputSchema = z
  .string()
  .min(1)
  .describe(
    "Nakafa content reference: a content_id returned by search, a canonical Nakafa URL, or a nakafa://content/... resource URI."
  );

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
    queries: z
      .array(z.string().trim().min(1))
      .max(NAKAFA_AGENT_MAX_QUERIES)
      .optional()
      .describe(
        "Optional search-engine query strings over synced Nakafa title, route, localized labels, and content text."
      ),
    section: NakafaSectionSchema.optional().describe(
      "Optional top-level content section filter."
    ),
  })
  .strict()
  .describe("Nakafa content search options.");

/** Output schema for `nakafa_search_content` success and error results. */
export const NakafaSearchContentOutputSchema = z
  .object({
    count: z.number().int().min(0).describe("Number of returned results."),
    has_more: z.boolean().describe("Whether another page is available."),
    items: z
      .array(NakafaContentSummarySchema)
      .describe("Bounded search result page."),
    limit: z.number().int().min(1).describe("Requested page size."),
    next_offset: z
      .number()
      .int()
      .min(0)
      .nullable()
      .describe("Next offset, or null when there is no next page."),
    offset: z.number().int().min(0).describe("Current result offset."),
    ...NakafaMcpToolErrorSchema.shape,
  })
  .partial()
  .describe("Nakafa content search output.");

/** Input schema for `nakafa_get_content`. */
export const NakafaGetContentInputSchema = z
  .object({
    content_ref: NakafaMcpContentRefInputSchema,
  })
  .strict()
  .describe("Nakafa content read options.");

/** Output schema for `nakafa_get_content` success and error results. */
export const NakafaGetContentOutputSchema = z
  .object({
    ...NakafaContentRefSchema.shape,
    description: z.string().describe("Short content description."),
    text: z.string().describe("Full agent-readable markdown text."),
    title: z.string().describe("Human-readable content title."),
    ...NakafaMcpToolErrorSchema.shape,
  })
  .partial()
  .describe("Nakafa content markdown output.");

/** Input schema for `nakafa_get_taxonomy`. */
export const NakafaGetTaxonomyInputSchema = z
  .object({
    locale: LocaleSchema.default(routing.defaultLocale).describe(
      "Locale used for localized labels and content counts."
    ),
  })
  .strict()
  .describe("Nakafa taxonomy options.");

/** Output schema for `nakafa_get_taxonomy` success and error results. */
export const NakafaGetTaxonomyOutputSchema = z
  .object({
    content_counts: z.array(
      z.object({
        count: z.number().int().min(0),
        locale: LocaleSchema,
      })
    ),
    locale: LocaleSchema,
    sections: z.array(NakafaSectionSchema),
    tools: z.array(z.string()),
    ...NakafaMcpToolErrorSchema.shape,
  })
  .partial()
  .passthrough()
  .describe("Nakafa taxonomy output.");

/** Input schema for `nakafa_get_exercise`. */
export const NakafaGetExerciseInputSchema = z
  .object({
    content_ref: NakafaMcpContentRefInputSchema,
    exercise_number: z.number().int().min(1).optional(),
  })
  .strict()
  .describe("Nakafa exercise read options.");

const NakafaExerciseContentSchema = z.object({
  raw: z.string(),
  title: z.string(),
});

/** Output schema for `nakafa_get_exercise` success and error results. */
export const NakafaGetExerciseOutputSchema = z
  .object({
    ...NakafaContentRefSchema.shape,
    count: z.number().int().min(1),
    exercise_number: z.number().int().min(1).nullable(),
    exercises: z.array(
      z.object({
        answer: NakafaExerciseContentSchema,
        choices: z.array(
          z.object({
            correct: z.boolean(),
            label: z.string(),
          })
        ),
        number: z.number().int().min(1),
        question: NakafaExerciseContentSchema,
      })
    ),
    ...NakafaMcpToolErrorSchema.shape,
  })
  .partial()
  .describe("Nakafa exercise output.");

/** Input schema for `nakafa_get_quran_reference`. */
export const NakafaGetQuranReferenceInputSchema = z
  .object({
    from_verse: z.number().int().min(1).default(1),
    include_tafsir: z.boolean().default(false),
    locale: LocaleSchema.default(routing.defaultLocale),
    surah: z.number().int().min(1).max(114),
    to_verse: z.number().int().min(1).optional(),
  })
  .strict()
  .describe("Nakafa Quran reference options.");

/** Output schema for `nakafa_get_quran_reference` success and error results. */
export const NakafaGetQuranReferenceOutputSchema = z
  .object({
    ...NakafaContentRefSchema.shape,
    name: z.string(),
    revelation: z.string(),
    translation: z.string(),
    verses: z.array(
      z.object({
        arabic: z.string(),
        number: z.number().int().min(1),
        tafsir: z.string().optional(),
        translation: z.string(),
        transliteration: z.string(),
      })
    ),
    ...NakafaMcpToolErrorSchema.shape,
  })
  .partial()
  .describe("Nakafa Quran reference output.");

export type NakafaMcpQuranReferenceInput = z.infer<
  typeof NakafaGetQuranReferenceInputSchema
>;
