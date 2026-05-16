import { NAKAFA_AGENT_SECTIONS } from "@repo/contents/_lib/agent/constants";
import { MathDataSchema } from "@repo/math/schema/data";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";

const LocaleSchema = Schema.Literal(...locales);
const NakafaSectionSchema = Schema.Literal(...NAKAFA_AGENT_SECTIONS);
const StatusSchema = Schema.Literal("loading", "done", "error");

const contentRefFields = {
  content_id: Schema.String,
  locale: LocaleSchema,
  markdown_url: Schema.String,
  route: Schema.String,
  section: NakafaSectionSchema,
  url: Schema.String,
};

const ContentSummarySchema = Schema.Struct({
  ...contentRefFields,
  description: Schema.String,
  title: Schema.String,
}).pipe(Schema.mutable);

const SearchInputSchema = Schema.Struct({
  limit: Schema.Number,
  locale: LocaleSchema,
  offset: Schema.Number,
  queries: Schema.optional(Schema.Array(Schema.String).pipe(Schema.mutable)),
  section: Schema.optional(NakafaSectionSchema),
}).pipe(Schema.mutable);

const SearchResultSchema = Schema.Struct({
  count: Schema.Number,
  has_more: Schema.Boolean,
  items: Schema.Array(ContentSummarySchema).pipe(Schema.mutable),
  limit: Schema.Number,
  next_offset: Schema.NullOr(Schema.Number),
  offset: Schema.Number,
}).pipe(Schema.mutable);

const ReadInputSchema = Schema.Struct({
  content_ref: Schema.String,
}).pipe(Schema.mutable);

const ExerciseInputSchema = Schema.Struct({
  content_ref: Schema.String,
  exercise_number: Schema.optional(Schema.Number),
}).pipe(Schema.mutable);

const ExercisePreviewSchema = Schema.Struct({
  ...contentRefFields,
  count: Schema.Number,
  exercise_number: Schema.NullOr(Schema.Number),
  numbers: Schema.Array(Schema.Number).pipe(Schema.mutable),
  title: Schema.String,
}).pipe(Schema.mutable);

const QuranInputSchema = Schema.Struct({
  from_verse: Schema.Number,
  include_tafsir: Schema.Boolean,
  locale: LocaleSchema,
  surah: Schema.Number,
  to_verse: Schema.optional(Schema.Number),
}).pipe(Schema.mutable);

const QuranPreviewSchema = Schema.Struct({
  ...contentRefFields,
  from_verse: Schema.Number,
  name: Schema.String,
  revelation: Schema.String,
  to_verse: Schema.Number,
  translation: Schema.String,
  verse_count: Schema.Number,
}).pipe(Schema.mutable);

const TaxonomyInputSchema = Schema.Struct({
  locale: LocaleSchema,
}).pipe(Schema.mutable);

const TaxonomyPreviewSchema = Schema.Struct({
  content_counts: Schema.Array(
    Schema.Struct({
      count: Schema.Number,
      locale: LocaleSchema,
    }).pipe(Schema.mutable)
  ).pipe(Schema.mutable),
  locale: LocaleSchema,
  sections: Schema.Array(NakafaSectionSchema).pipe(Schema.mutable),
  tools: Schema.Array(Schema.String).pipe(Schema.mutable),
}).pipe(Schema.mutable);

const nakafaSearchLoadingFields = {
  input: SearchInputSchema,
  kind: Schema.Literal("search"),
  status: Schema.Literal("loading"),
};

const NakafaSearchLoadingSchema = Schema.Struct(nakafaSearchLoadingFields).pipe(
  Schema.mutable
);

const NakafaSearchDoneSchema = Schema.Struct({
  ...nakafaSearchLoadingFields,
  result: SearchResultSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const NakafaSearchErrorSchema = Schema.Struct({
  ...nakafaSearchLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

const nakafaContentLoadingFields = {
  input: ReadInputSchema,
  kind: Schema.Literal("content"),
  status: Schema.Literal("loading"),
};

const NakafaContentLoadingSchema = Schema.Struct(
  nakafaContentLoadingFields
).pipe(Schema.mutable);

const NakafaContentDoneSchema = Schema.Struct({
  ...nakafaContentLoadingFields,
  result: ContentSummarySchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const NakafaContentErrorSchema = Schema.Struct({
  ...nakafaContentLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

const nakafaExerciseLoadingFields = {
  input: ExerciseInputSchema,
  kind: Schema.Literal("exercise"),
  status: Schema.Literal("loading"),
};

const NakafaExerciseLoadingSchema = Schema.Struct(
  nakafaExerciseLoadingFields
).pipe(Schema.mutable);

const NakafaExerciseDoneSchema = Schema.Struct({
  ...nakafaExerciseLoadingFields,
  result: ExercisePreviewSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const NakafaExerciseErrorSchema = Schema.Struct({
  ...nakafaExerciseLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

const nakafaQuranLoadingFields = {
  input: QuranInputSchema,
  kind: Schema.Literal("quran"),
  status: Schema.Literal("loading"),
};

const NakafaQuranLoadingSchema = Schema.Struct(nakafaQuranLoadingFields).pipe(
  Schema.mutable
);

const NakafaQuranDoneSchema = Schema.Struct({
  ...nakafaQuranLoadingFields,
  result: QuranPreviewSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const NakafaQuranErrorSchema = Schema.Struct({
  ...nakafaQuranLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

const nakafaTaxonomyLoadingFields = {
  input: TaxonomyInputSchema,
  kind: Schema.Literal("taxonomy"),
  status: Schema.Literal("loading"),
};

const NakafaTaxonomyLoadingSchema = Schema.Struct(
  nakafaTaxonomyLoadingFields
).pipe(Schema.mutable);

const NakafaTaxonomyDoneSchema = Schema.Struct({
  ...nakafaTaxonomyLoadingFields,
  result: TaxonomyPreviewSchema,
  status: Schema.Literal("done"),
}).pipe(Schema.mutable);

const NakafaTaxonomyErrorSchema = Schema.Struct({
  ...nakafaTaxonomyLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe(Schema.mutable);

/**
 * UI data payloads written by Nakafa sub-tools.
 */
export const NakafaDataSchema = Schema.Union(
  NakafaSearchLoadingSchema,
  NakafaSearchDoneSchema,
  NakafaSearchErrorSchema,
  NakafaContentLoadingSchema,
  NakafaContentDoneSchema,
  NakafaContentErrorSchema,
  NakafaExerciseLoadingSchema,
  NakafaExerciseDoneSchema,
  NakafaExerciseErrorSchema,
  NakafaQuranLoadingSchema,
  NakafaQuranDoneSchema,
  NakafaQuranErrorSchema,
  NakafaTaxonomyLoadingSchema,
  NakafaTaxonomyDoneSchema,
  NakafaTaxonomyErrorSchema
);

/**
 * UI data parts written by Nina agents.
 */
export const DataPartSchema = Schema.Struct({
  math: MathDataSchema,
  nakafa: NakafaDataSchema,
  "scrape-url": Schema.Struct({
    content: Schema.String,
    description: Schema.optional(Schema.String),
    error: Schema.optional(Schema.String),
    favicon: Schema.optional(Schema.String),
    status: StatusSchema,
    title: Schema.optional(Schema.String),
    url: Schema.String,
  }).pipe(Schema.mutable),
  suggestions: Schema.Struct({
    data: Schema.Array(Schema.String).pipe(Schema.mutable),
  }).pipe(Schema.mutable),
  "web-search": Schema.Struct({
    error: Schema.optional(Schema.String),
    provider: Schema.optional(Schema.Literal("firecrawl", "google")),
    queries: Schema.Array(Schema.String).pipe(Schema.mutable),
    sources: Schema.Array(
      Schema.Struct({
        citation: Schema.String,
        content: Schema.String,
        description: Schema.String,
        title: Schema.String,
        url: Schema.String,
      }).pipe(Schema.mutable)
    ).pipe(Schema.mutable),
    status: StatusSchema,
  }).pipe(Schema.mutable),
}).pipe(Schema.mutable);

export type DataPart = Schema.Schema.Type<typeof DataPartSchema>;
export type NakafaDataPart = Schema.Schema.Type<typeof NakafaDataSchema>;
