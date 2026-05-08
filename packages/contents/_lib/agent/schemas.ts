import {
  NAKAFA_AGENT_DEFAULT_LIMIT,
  NAKAFA_AGENT_MAX_LIMIT,
  NAKAFA_AGENT_SECTIONS,
} from "@repo/contents/_lib/agent/constants";
import { LocaleSchema } from "@repo/contents/_types/content";
import * as z from "zod";

/** Runtime schema for public Nakafa sections exposed to agents. */
export const NakafaAgentSectionSchema = z
  .enum(NAKAFA_AGENT_SECTIONS)
  .describe("Public Nakafa content section.");

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
    locale: LocaleSchema.default("en").describe("Locale to search."),
    offset: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe("Zero-based result offset for pagination."),
    query: z
      .string()
      .trim()
      .optional()
      .describe(
        "Optional case-insensitive query over title, description, ID, and URL."
      ),
    section: NakafaAgentSectionSchema.optional().describe(
      "Optional section filter."
    ),
  })
  .describe("Nakafa content search options.");

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

/** Runtime schema for exercise read input. */
export const NakafaAgentExerciseOptionsSchema = z
  .object({
    content_ref: NakafaAgentContentRefInputSchema,
    exercise_number: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Optional exercise number inside the set."),
  })
  .strict()
  .describe("Nakafa exercise read options.");

/** Runtime schema for taxonomy input. */
export const NakafaAgentTaxonomyOptionsSchema = z
  .object({
    locale: LocaleSchema.default("en").describe(
      "Locale used for localized labels and content counts."
    ),
  })
  .describe("Nakafa taxonomy options.");

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
    total_count: z
      .number()
      .int()
      .min(0)
      .describe("Total matching result count."),
  })
  .describe("Paginated Nakafa content search result.");

/** Runtime schema for markdown retrieval output. */
export const NakafaAgentMarkdownSchema = NakafaAgentContentRefSchema.extend({
  description: z.string().describe("Short content description."),
  text: z.string().describe("Full agent-readable markdown text."),
  title: z.string().describe("Human-readable content title."),
}).describe("Full Nakafa content markdown payload.");

/** Runtime schema for one exercise choice. */
export const NakafaAgentExerciseChoiceSchema = z
  .object({
    correct: z.boolean().describe("Whether this choice is the correct answer."),
    label: z.string().describe("Choice label exactly as published."),
  })
  .describe("Nakafa exercise choice.");

/** Runtime schema for one exercise question and explanation. */
export const NakafaAgentExerciseItemSchema = z
  .object({
    answer: z
      .object({
        raw: z.string().describe("Raw answer and explanation markdown."),
        title: z.string().describe("Answer metadata title."),
      })
      .describe("Published answer and explanation."),
    choices: z
      .array(NakafaAgentExerciseChoiceSchema)
      .describe("Multiple-choice answer options."),
    number: z.number().int().min(1).describe("Exercise number inside the set."),
    question: z
      .object({
        raw: z.string().describe("Raw question markdown."),
        title: z.string().describe("Question metadata title."),
      })
      .describe("Published question content."),
  })
  .describe("Structured Nakafa exercise item.");

/** Runtime schema for exercise retrieval output. */
export const NakafaAgentExerciseResultSchema =
  NakafaAgentContentRefSchema.extend({
    count: z.number().int().min(1).describe("Number of returned exercises."),
    exercise_number: z
      .number()
      .int()
      .min(1)
      .nullable()
      .describe(
        "Requested exercise number, or null when returning a whole set."
      ),
    exercises: z
      .array(NakafaAgentExerciseItemSchema)
      .min(1)
      .describe("Structured exercises."),
  }).describe("Nakafa exercise set or single exercise result.");

/** Runtime schema for Quran reference input. */
export const NakafaAgentQuranReferenceOptionsSchema = z
  .object({
    from_verse: z
      .number()
      .int()
      .min(1)
      .default(1)
      .describe("First verse number to include."),
    include_tafsir: z
      .boolean()
      .default(false)
      .describe("Whether to include concise Indonesian tafsir text."),
    locale: LocaleSchema.default("en").describe("Translation locale."),
    surah: z.number().int().min(1).max(114).describe("Surah number."),
    to_verse: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe("Last verse number to include; defaults to from_verse."),
  })
  .describe("Nakafa Quran reference options.");

/** Runtime schema for one Quran verse returned to agents. */
export const NakafaAgentQuranVerseSchema = z
  .object({
    arabic: z.string().describe("Arabic Quran verse text."),
    number: z.number().int().min(1).describe("Verse number inside the surah."),
    tafsir: z.string().optional().describe("Optional concise tafsir text."),
    translation: z.string().describe("Selected translation text."),
    transliteration: z.string().describe("Latin transliteration text."),
  })
  .describe("Nakafa Quran verse reference.");

/** Runtime schema for Quran reference output. */
export const NakafaAgentQuranReferenceSchema =
  NakafaAgentContentRefSchema.extend({
    name: z.string().describe("Localized surah display name."),
    revelation: z.string().describe("Localized revelation place."),
    translation: z.string().describe("Localized surah name translation."),
    verses: z
      .array(NakafaAgentQuranVerseSchema)
      .min(1)
      .describe("Bounded Quran verses."),
  }).describe("Nakafa Quran reference result.");

/** Runtime schema for taxonomy output. */
export const NakafaAgentTaxonomySchema = z
  .object({
    articles: z
      .object({
        categories: z
          .array(z.string())
          .describe("Supported article categories."),
      })
      .describe("Article taxonomy."),
    content_counts: z
      .array(
        z.object({
          count: z.number().int().min(0).describe("Indexed content count."),
          locale: LocaleSchema.describe("Locale for this count."),
        })
      )
      .describe("Indexed content counts by locale."),
    default_locale: LocaleSchema.describe("Default Nakafa locale."),
    endpoints: z
      .object({
        direct: z.url().describe("Direct MCP endpoint."),
        recommended: z.url().describe("Recommended MCP endpoint."),
        root_note: z.string().describe("Root URL connection guidance."),
      })
      .describe("MCP endpoint guidance."),
    exercises: z
      .object({
        categories: z
          .array(z.string())
          .describe("Supported exercise categories."),
        materials: z
          .array(z.string())
          .describe("Supported exercise materials."),
        types: z.array(z.string()).describe("Supported exercise types."),
      })
      .describe("Exercise taxonomy."),
    locale: LocaleSchema.describe("Locale used for this taxonomy response."),
    locales: z.array(LocaleSchema).describe("Supported content locales."),
    quran: z
      .object({
        surah_count: z
          .number()
          .int()
          .min(1)
          .describe("Indexed Quran surah count."),
      })
      .describe("Quran taxonomy."),
    sections: z
      .array(NakafaAgentSectionSchema)
      .describe("Supported top-level content sections."),
    subject: z
      .object({
        categories: z
          .array(z.string())
          .describe("Supported subject categories."),
        grades: z.array(z.string()).describe("Supported grade segments."),
        materials: z.array(z.string()).describe("Supported subject materials."),
      })
      .describe("Subject taxonomy."),
    tools: z.array(z.string()).describe("Public MCP tools exposed by Nakafa."),
  })
  .describe("Nakafa public content taxonomy.");

export type NakafaAgentSection = z.infer<typeof NakafaAgentSectionSchema>;
export type NakafaAgentContentRef = z.infer<typeof NakafaAgentContentRefSchema>;
export type NakafaAgentContentSummary = z.infer<
  typeof NakafaAgentContentSummarySchema
>;
export type NakafaAgentSearchOptions = z.input<
  typeof NakafaAgentSearchOptionsSchema
>;
export type NakafaAgentSearchInput = z.output<
  typeof NakafaAgentSearchOptionsSchema
>;
export type NakafaAgentReadOptions = z.infer<
  typeof NakafaAgentReadOptionsSchema
>;
export type NakafaAgentExerciseOptions = z.infer<
  typeof NakafaAgentExerciseOptionsSchema
>;
export type NakafaAgentTaxonomyOptions = z.output<
  typeof NakafaAgentTaxonomyOptionsSchema
>;
export type NakafaAgentSearchResult = z.infer<
  typeof NakafaAgentSearchResultSchema
>;
export type NakafaAgentMarkdown = z.infer<typeof NakafaAgentMarkdownSchema>;
export type NakafaAgentExerciseItem = z.infer<
  typeof NakafaAgentExerciseItemSchema
>;
export type NakafaAgentExerciseResult = z.infer<
  typeof NakafaAgentExerciseResultSchema
>;
export type NakafaAgentQuranReferenceOptions = z.input<
  typeof NakafaAgentQuranReferenceOptionsSchema
>;
export type NakafaAgentQuranReference = z.infer<
  typeof NakafaAgentQuranReferenceSchema
>;
export type NakafaAgentTaxonomy = z.infer<typeof NakafaAgentTaxonomySchema>;
