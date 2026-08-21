import {
  NakafaAgentContentSummarySchema,
  NakafaAgentSectionSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import {
  NAKAFA_AGENT_DEFAULT_LIMIT,
  NAKAFA_AGENT_MAX_LIMIT,
  NAKAFA_AGENT_MAX_OFFSET,
  NAKAFA_AGENT_MAX_QUERIES,
} from "@repo/contents/_types/agent/search";
import { LocaleSchema } from "@repo/contents/_types/content";
import { routing } from "@repo/internationalization/src/routing";
import { Effect, Schema, Struct } from "effect";

/** Runtime schema for one Convex-backed search result item. */
const NakafaAgentSearchItemSchema = NakafaAgentContentSummarySchema.mapFields(
  (fields) => ({
    ...fields,
    excerpt: Schema.String.annotate({
      description: "Plain-text search excerpt with matched context.",
    }),
  }),
  { unsafePreserveChecks: true }
)
  .mapFields(Struct.map(Schema.mutableKey), { unsafePreserveChecks: true })
  .annotate({ description: "Searchable Nakafa content result item." });
/** Runtime schema for content search input. */
export const NakafaAgentSearchOptionsSchema = Schema.Struct({
  limit: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(
      Schema.isBetween(
        { minimum: 1, maximum: NAKAFA_AGENT_MAX_LIMIT },
        {
          message: `Expected a number between 1 and ${NAKAFA_AGENT_MAX_LIMIT}`,
        }
      )
    ),
    Schema.withDecodingDefaultType(Effect.succeed(NAKAFA_AGENT_DEFAULT_LIMIT))
  ).annotate({ description: "Maximum number of results to return." }),
  locale: LocaleSchema.pipe(
    Schema.withDecodingDefaultType(Effect.succeed(routing.defaultLocale))
  ).annotate({ description: "Locale to search." }),
  offset: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(
      Schema.isBetween(
        { minimum: 0, maximum: NAKAFA_AGENT_MAX_OFFSET },
        {
          message: `Expected a number between 0 and ${NAKAFA_AGENT_MAX_OFFSET}`,
        }
      )
    ),
    Schema.withDecodingDefaultType(Effect.succeed(0))
  ).annotate({ description: "Zero-based result offset for pagination." }),
  queries: Schema.optional(
    Schema.Array(Schema.Trim.pipe(Schema.check(Schema.isMinLength(1))))
      .pipe(
        Schema.mutable,
        Schema.check(Schema.isMaxLength(NAKAFA_AGENT_MAX_QUERIES))
      )
      .annotate({
        description:
          "Optional search-engine query strings over synced Nakafa title, route, localized labels, and content text. Use one string for one search, multiple strings for unique alternate phrasings in the same section and locale. Preserve exact identifiers such as names, years, labels, canonical IDs, and URLs. Use limit for requested counts. Use separate parallel search tool calls when section filters differ.",
      })
  ),
  section: Schema.optional(
    NakafaAgentSectionSchema.annotate({
      description:
        'Optional section filter. Use "material" for lessons, practice, school materials, class or grade topics, and study content. Use "articles" only when the user explicitly asks for articles, news, essays, analysis, or editorial content. Use "quran" for surah, ayah, tafsir, or Quran references. Omit this filter for broad topic discovery.',
    })
  ),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({ description: "Nakafa content search options." });
/** Runtime schema for paginated Nakafa content search output. */
export const NakafaAgentSearchResultSchema = Schema.Struct({
  count: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ).annotate({
    description: "Number of returned results.",
  }),
  has_more: Schema.Boolean.annotate({
    description: "Whether another page is available.",
  }),
  items: Schema.Array(NakafaAgentSearchItemSchema)
    .pipe(Schema.mutable)
    .annotate({ description: "Bounded search result page." }),
  limit: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThan(0))
  ).annotate({
    description: "Requested page size.",
  }),
  next_offset: Schema.optional(
    Schema.Finite.pipe(
      Schema.check(Schema.isInt()),
      Schema.check(Schema.isGreaterThanOrEqualTo(0))
    ).annotate({
      description: "Next page offset when another page is available.",
    })
  ),
  offset: Schema.Finite.pipe(
    Schema.check(Schema.isInt()),
    Schema.check(Schema.isGreaterThanOrEqualTo(0))
  ).annotate({
    description: "Current result offset.",
  }),
})
  .pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  .annotate({ description: "Paginated Nakafa content search result." });
export type NakafaAgentSearchOptions = Schema.Codec.Encoded<
  typeof NakafaAgentSearchOptionsSchema
>;
export type NakafaAgentSearchInput = Schema.Schema.Type<
  typeof NakafaAgentSearchOptionsSchema
>;
export type NakafaAgentSearchResult = Schema.Schema.Type<
  typeof NakafaAgentSearchResultSchema
>;
