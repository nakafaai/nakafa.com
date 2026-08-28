import {
  ActiveAppLocaleCodeSchema,
  type AppLocaleCode,
  ENGLISH_APP_LOCALE_CODE,
  GERMAN_APP_LOCALE_CODE,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import { NakafaAgentQuranReferenceOptionsSchema } from "@repo/contents/_lib/agent/schema/quran/input";
import { NakafaAgentReadOptionsSchema } from "@repo/contents/_lib/agent/schema/read";
import {
  NakafaAgentContentRefSchema,
  NakafaAgentSectionSchema,
} from "@repo/contents/_lib/agent/schema/ref";
import {
  NakafaAgentSearchOptionsSchema,
  NakafaAgentSearchResultSchema,
} from "@repo/contents/_lib/agent/schema/search";
import { NakafaAgentTaxonomyOptionsSchema } from "@repo/contents/_lib/agent/schema/taxonomy";
import { MathDataSchema } from "@repo/math/schema/data";
import { Schema, Struct } from "effect";

const LocaleSchema = ActiveAppLocaleCodeSchema;
const StatusSchema = Schema.Literals(["loading", "done", "error"]);
const ContentPreviewSchema = NakafaAgentContentRefSchema.mapFields(
  (fields) => ({
    ...fields,
    description: Schema.optional(Schema.String),
    title: Schema.String,
  })
).mapFields(Struct.map(Schema.mutableKey));
const SearchInputSchema = NakafaAgentSearchOptionsSchema;
const SearchResultSchema = NakafaAgentSearchResultSchema;
const ReadInputSchema = NakafaAgentReadOptionsSchema;
const QuranInputSchema = NakafaAgentQuranReferenceOptionsSchema;
const TaxonomyInputSchema = NakafaAgentTaxonomyOptionsSchema;
const quranPreviewFields = {
  ...NakafaAgentContentRefSchema.fields,
  from_verse: Schema.Finite,
  name: Schema.String,
  revelation: Schema.String,
  to_verse: Schema.Finite,
  verse_count: Schema.Finite,
};

/** Builds one canonical Quran preview correlated to its request locale. */
function makeQuranDoneSchema<const Locale extends AppLocaleCode>(
  locale: Locale
) {
  return Schema.Struct({
    input: Schema.Struct({
      ...QuranInputSchema.fields,
      locale: Schema.Literal(locale),
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
    kind: Schema.Literal("quran"),
    result: Schema.Struct({
      ...quranPreviewFields,
      locale: Schema.Literal(locale),
      meaning: Schema.Struct({
        locale: Schema.Union([
          Schema.Literal(locale),
          Schema.Literal(ENGLISH_APP_LOCALE_CODE),
        ]),
        text: Schema.String,
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
    status: Schema.Literal("done"),
  }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
}

const NakafaQuranDoneSchema = Schema.Union([
  makeQuranDoneSchema(ENGLISH_APP_LOCALE_CODE),
  makeQuranDoneSchema(INDONESIAN_APP_LOCALE_CODE),
  makeQuranDoneSchema(GERMAN_APP_LOCALE_CODE),
]);
const TaxonomyPreviewSchema = Schema.Struct({
  content_counts: Schema.Array(
    Schema.Struct({
      count: Schema.Finite,
      locale: LocaleSchema,
    }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
  ).pipe(Schema.mutable),
  locale: LocaleSchema,
  sections: Schema.Array(NakafaAgentSectionSchema).pipe(Schema.mutable),
  tools: Schema.Array(Schema.String).pipe(Schema.mutable),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const nakafaSearchLoadingFields = {
  input: SearchInputSchema,
  kind: Schema.Literal("search"),
  status: Schema.Literal("loading"),
};
const NakafaSearchLoadingSchema = Schema.Struct(nakafaSearchLoadingFields).pipe(
  (schema) => schema.mapFields(Struct.map(Schema.mutableKey))
);
const NakafaSearchDoneSchema = Schema.Struct({
  ...nakafaSearchLoadingFields,
  result: SearchResultSchema,
  status: Schema.Literal("done"),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const NakafaSearchErrorSchema = Schema.Struct({
  ...nakafaSearchLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const nakafaContentLoadingFields = {
  input: ReadInputSchema,
  kind: Schema.Literal("content"),
  status: Schema.Literal("loading"),
};
const NakafaContentLoadingSchema = Schema.Struct(
  nakafaContentLoadingFields
).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const NakafaContentDoneSchema = Schema.Struct({
  ...nakafaContentLoadingFields,
  result: ContentPreviewSchema,
  status: Schema.Literal("done"),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const NakafaContentErrorSchema = Schema.Struct({
  ...nakafaContentLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const nakafaQuranLoadingFields = {
  input: QuranInputSchema,
  kind: Schema.Literal("quran"),
  status: Schema.Literal("loading"),
};
const NakafaQuranLoadingSchema = Schema.Struct(nakafaQuranLoadingFields).pipe(
  (schema) => schema.mapFields(Struct.map(Schema.mutableKey))
);
const NakafaQuranErrorSchema = Schema.Struct({
  ...nakafaQuranLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const nakafaTaxonomyLoadingFields = {
  input: TaxonomyInputSchema,
  kind: Schema.Literal("taxonomy"),
  status: Schema.Literal("loading"),
};
const NakafaTaxonomyLoadingSchema = Schema.Struct(
  nakafaTaxonomyLoadingFields
).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const NakafaTaxonomyDoneSchema = Schema.Struct({
  ...nakafaTaxonomyLoadingFields,
  result: TaxonomyPreviewSchema,
  status: Schema.Literal("done"),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
const NakafaTaxonomyErrorSchema = Schema.Struct({
  ...nakafaTaxonomyLoadingFields,
  error: Schema.String,
  status: Schema.Literal("error"),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
/**
 * UI data payloads written by Nakafa sub-tools.
 */
export const NakafaDataSchema = Schema.Union([
  NakafaSearchLoadingSchema,
  NakafaSearchDoneSchema,
  NakafaSearchErrorSchema,
  NakafaContentLoadingSchema,
  NakafaContentDoneSchema,
  NakafaContentErrorSchema,
  NakafaQuranLoadingSchema,
  NakafaQuranDoneSchema,
  NakafaQuranErrorSchema,
  NakafaTaxonomyLoadingSchema,
  NakafaTaxonomyDoneSchema,
  NakafaTaxonomyErrorSchema,
]);
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
  }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
  suggestions: Schema.Struct({
    data: Schema.Array(Schema.String).pipe(Schema.mutable),
  }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
  "web-search": Schema.Struct({
    error: Schema.optional(Schema.String),
    provider: Schema.optional(Schema.Literals(["firecrawl", "google"])),
    queries: Schema.Array(Schema.String).pipe(Schema.mutable),
    sources: Schema.Array(
      Schema.Struct({
        citation: Schema.String,
        content: Schema.String,
        description: Schema.String,
        title: Schema.String,
        url: Schema.String,
      }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)))
    ).pipe(Schema.mutable),
    status: StatusSchema,
  }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey))),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
export type DataPart = Schema.Schema.Type<typeof DataPartSchema>;
export type NakafaDataPart = Schema.Schema.Type<typeof NakafaDataSchema>;
