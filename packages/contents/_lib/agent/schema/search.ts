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
import { Schema } from "effect";

/** Runtime schema for one Convex-backed search result item. */
export const NakafaAgentSearchItemSchema = NakafaAgentContentSummarySchema.pipe(
  Schema.extend(
    Schema.Struct({
      excerpt: Schema.String.annotations({
        description: "Plain-text search excerpt with matched context.",
      }),
    })
  ),
  Schema.mutable
).annotations({ description: "Searchable Nakafa content result item." });

/** Runtime schema for content search input. */
export const NakafaAgentSearchOptionsSchema = Schema.Struct({
  limit: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.between(1, NAKAFA_AGENT_MAX_LIMIT)),
    { default: () => NAKAFA_AGENT_DEFAULT_LIMIT }
  ).annotations({ description: "Maximum number of results to return." }),
  locale: Schema.optionalWith(LocaleSchema, {
    default: () => routing.defaultLocale,
  }).annotations({ description: "Locale to search." }),
  offset: Schema.optionalWith(
    Schema.Number.pipe(
      Schema.int(),
      Schema.between(0, NAKAFA_AGENT_MAX_OFFSET)
    ),
    { default: () => 0 }
  ).annotations({ description: "Zero-based result offset for pagination." }),
  queries: Schema.optional(
    Schema.Array(Schema.Trim.pipe(Schema.minLength(1)))
      .pipe(Schema.maxItems(NAKAFA_AGENT_MAX_QUERIES), Schema.mutable)
      .annotations({
        description:
          "Optional search-engine query strings over synced Nakafa title, route, localized labels, and content text. Use one string for one search, multiple strings for unique alternate phrasings in the same section and locale. Preserve exact identifiers such as names, years, labels, canonical IDs, and URLs. Use limit for requested counts. Use separate parallel search tool calls when section filters differ.",
      })
  ),
  section: Schema.optional(
    NakafaAgentSectionSchema.annotations({
      description:
        'Optional section filter. Use "material" for lessons, practice, school materials, class or grade topics, and study content. Use "articles" only when the user explicitly asks for articles, news, essays, analysis, or editorial content. Use "quran" for surah, ayah, tafsir, or Quran references. Omit this filter for broad topic discovery.',
    })
  ),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Nakafa content search options." });

/** Runtime schema for paginated Nakafa content search output. */
export const NakafaAgentSearchResultSchema = Schema.Struct({
  count: Schema.Number.pipe(Schema.int(), Schema.nonNegative()).annotations({
    description: "Number of returned results.",
  }),
  has_more: Schema.Boolean.annotations({
    description: "Whether another page is available.",
  }),
  items: Schema.Array(NakafaAgentSearchItemSchema)
    .pipe(Schema.mutable)
    .annotations({ description: "Bounded search result page." }),
  limit: Schema.Number.pipe(Schema.int(), Schema.positive()).annotations({
    description: "Requested page size.",
  }),
  next_offset: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.nonNegative()).annotations({
      description: "Next page offset when another page is available.",
    })
  ),
  offset: Schema.Number.pipe(Schema.int(), Schema.nonNegative()).annotations({
    description: "Current result offset.",
  }),
})
  .pipe(Schema.mutable)
  .annotations({ description: "Paginated Nakafa content search result." });

export type NakafaAgentSearchOptions = Schema.Schema.Encoded<
  typeof NakafaAgentSearchOptionsSchema
>;
export type NakafaAgentSearchInput = Schema.Schema.Type<
  typeof NakafaAgentSearchOptionsSchema
>;
export type NakafaAgentSearchResult = Schema.Schema.Type<
  typeof NakafaAgentSearchResultSchema
>;
