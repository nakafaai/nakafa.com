import {
  type AppLocaleCode,
  ENGLISH_APP_LOCALE_CODE,
  GERMAN_APP_LOCALE_CODE,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import {
  type QuranEmbeddedSourceId,
  type QuranExternalSourceId,
  quranReadingSourceIds,
  quranTafsirSourceId,
  quranTranslationSourceId,
} from "@nakafa/aksara-contracts/quran/identity";
import {
  QuranEmbeddedSourceAttributionSchema,
  QuranExternalSourceAttributionSchema,
  QuranSourceArtifactSchema,
  QuranSourceCopySchema,
} from "@nakafa/aksara-contracts/quran/source";
import { Schema, Struct } from "effect";

/** Public snake-case identity for one signed source artifact. */
const NakafaQuranSourceArtifactSchema = QuranSourceArtifactSchema.mapFields(
  (fields) => ({
    byte_count: fields.byteCount,
    digest: fields.digest,
    file_count: fields.fileCount,
  })
).mapFields(Struct.map(Schema.mutableKey));

const NakafaQuranEmbeddedTermsSchema = Schema.Struct({
  artifact: NakafaQuranSourceArtifactSchema,
  url: QuranEmbeddedSourceAttributionSchema.fields.terms.fields.url,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

const NakafaQuranExternalTermsSchema = Schema.Struct({
  access: QuranExternalSourceAttributionSchema.fields.terms.fields.access,
  url: QuranExternalSourceAttributionSchema.fields.terms.fields.url,
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

/** Localized public metadata for one signed embedded Quran source. */
export const NakafaQuranEmbeddedSourceSchema =
  QuranEmbeddedSourceAttributionSchema.mapFields((fields) => ({
    artifact: NakafaQuranSourceArtifactSchema,
    id: fields.id,
    kind: fields.kind,
    label: QuranSourceCopySchema.fields.title,
    notice: QuranSourceCopySchema.fields.notice,
    publisher: fields.publisher,
    retrieved_at: fields.retrievedAt,
    source_url: fields.sourceUrl,
    terms: NakafaQuranEmbeddedTermsSchema,
    update_url: fields.updateUrl,
    version: fields.version,
  }))
    .mapFields(Struct.map(Schema.mutableKey))
    .annotate({
      description:
        "Localized attribution for official source bytes authenticated by Aksara.",
    });

/** Localized public metadata for one official link-only Quran source. */
export const NakafaQuranExternalSourceSchema =
  QuranExternalSourceAttributionSchema.mapFields((fields) => ({
    id: fields.id,
    kind: fields.kind,
    label: QuranSourceCopySchema.fields.title,
    notice: QuranSourceCopySchema.fields.notice,
    publisher: fields.publisher,
    retrieved_at: fields.retrievedAt,
    source_url: fields.sourceUrl,
    terms: NakafaQuranExternalTermsSchema,
    update_url: fields.updateUrl,
    version: fields.version,
  }))
    .mapFields(Struct.map(Schema.mutableKey))
    .annotate({
      description:
        "Localized attribution for an official edition that remains link-only.",
    });

const NakafaQuranArabicSourceSchema = NakafaQuranEmbeddedSourceSchema.mapFields(
  (fields) => ({
    ...fields,
    id: Schema.Literal(quranReadingSourceIds(ENGLISH_APP_LOCALE_CODE)[0]),
  })
).mapFields(Struct.map(Schema.mutableKey));

/** Builds one exact locale and translation source relationship. */
function makeReadingSourcesSchema<
  const Locale extends AppLocaleCode,
  const SourceId extends QuranEmbeddedSourceId,
>(appLocale: Locale, sourceId: SourceId) {
  const translation = NakafaQuranEmbeddedSourceSchema.mapFields((fields) => ({
    ...fields,
    id: Schema.Literal(sourceId),
    locale: Schema.Literal(appLocale),
  })).mapFields(Struct.map(Schema.mutableKey));
  return Schema.Struct({
    arabic: NakafaQuranArabicSourceSchema,
    translation,
  }).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));
}

export const NakafaQuranEnglishReadingSourcesSchema = makeReadingSourcesSchema(
  ENGLISH_APP_LOCALE_CODE,
  quranTranslationSourceId(ENGLISH_APP_LOCALE_CODE)
);
export const NakafaQuranIndonesianReadingSourcesSchema =
  makeReadingSourcesSchema(
    INDONESIAN_APP_LOCALE_CODE,
    quranTranslationSourceId(INDONESIAN_APP_LOCALE_CODE)
  );
export const NakafaQuranGermanReadingSourcesSchema = makeReadingSourcesSchema(
  GERMAN_APP_LOCALE_CODE,
  quranTranslationSourceId(GERMAN_APP_LOCALE_CODE)
);

/** Exact signed Arabic and locale-selected translation sources. */
export const NakafaQuranReadingSourcesSchema = Schema.Union([
  NakafaQuranEnglishReadingSourcesSchema,
  NakafaQuranIndonesianReadingSourcesSchema,
  NakafaQuranGermanReadingSourcesSchema,
]).annotate({
  description: "Sources for the returned Arabic and translation.",
});

/** Narrows one embedded source to its Aksara-owned Tafsir identity. */
function makeEmbeddedTafsirSourceSchema<const Id extends QuranEmbeddedSourceId>(
  sourceId: Id
) {
  return NakafaQuranEmbeddedSourceSchema.mapFields((fields) => ({
    ...fields,
    id: Schema.Literal(sourceId),
  })).mapFields(Struct.map(Schema.mutableKey));
}

/** Narrows one external source to its Aksara-owned Tafsir identity. */
function makeExternalTafsirSourceSchema<const Id extends QuranExternalSourceId>(
  sourceId: Id
) {
  return NakafaQuranExternalSourceSchema.mapFields((fields) => ({
    ...fields,
    id: Schema.Literal(sourceId),
  })).mapFields(Struct.map(Schema.mutableKey));
}

export const NakafaQuranEnglishTafsirAccessSchema = Schema.Struct({
  kind: Schema.Literal("external"),
  locale: Schema.Literal(ENGLISH_APP_LOCALE_CODE),
  notice: QuranSourceCopySchema.fields.notice,
  source: makeExternalTafsirSourceSchema(
    quranTafsirSourceId(ENGLISH_APP_LOCALE_CODE)
  ),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

export const NakafaQuranIndonesianTafsirAccessSchema = Schema.Struct({
  kind: Schema.Literal("embedded"),
  locale: Schema.Literal(INDONESIAN_APP_LOCALE_CODE),
  notice: QuranSourceCopySchema.fields.notice,
  source: makeEmbeddedTafsirSourceSchema(
    quranTafsirSourceId(INDONESIAN_APP_LOCALE_CODE)
  ),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

export const NakafaQuranGermanTafsirAccessSchema = Schema.Struct({
  kind: Schema.Literal("external"),
  locale: Schema.Literal(GERMAN_APP_LOCALE_CODE),
  notice: QuranSourceCopySchema.fields.notice,
  source: makeExternalTafsirSourceSchema(
    quranTafsirSourceId(GERMAN_APP_LOCALE_CODE)
  ),
}).pipe((schema) => schema.mapFields(Struct.map(Schema.mutableKey)));

/** Signed locale-specific access to embedded or official external tafsir. */
export const NakafaQuranTafsirAccessSchema = Schema.Union([
  NakafaQuranEnglishTafsirAccessSchema,
  NakafaQuranIndonesianTafsirAccessSchema,
  NakafaQuranGermanTafsirAccessSchema,
]).annotate({
  description:
    "Signed tafsir access. External editions are linked but their text is not republished.",
});

export type NakafaQuranReadingSources = Schema.Schema.Type<
  typeof NakafaQuranReadingSourcesSchema
>;
export type NakafaQuranTafsirAccess = Schema.Schema.Type<
  typeof NakafaQuranTafsirAccessSchema
>;
