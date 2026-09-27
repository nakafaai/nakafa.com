import {
  APP_LOCALE_CODES,
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
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import { Schema } from "effect";
/** Runtime validator for every application locale supported by Quran reads. */
export const quranAppLocaleValidator = Schema.Literals([...APP_LOCALE_CODES]);

/** Runtime validator for app locales with a complete signed tafsir source. */
export const quranTafsirAppLocaleValidator = Schema.Literals([
  INDONESIAN_APP_LOCALE_CODE,
]);

/** Runtime validator derived from the signed revelation-place contract. */
export const quranRevelationPlaceValidator = Schema.Literals([
  ...QuranSurahRowSchema.fields.revelation.fields.place.literals,
]);

/** Complete locale-keyed meanings retained from the signed surah metadata row. */
export const quranSurahMeaningValidator = Schema.Union([
  Schema.Struct({
    de: Schema.String,
    en: Schema.String,
    id: Schema.String,
  }),
  Schema.Struct({
    appLocale: Schema.Literal(ENGLISH_APP_LOCALE_CODE),
    text: Schema.String,
  }),
]);
const quranSourceArtifactValidator = Schema.Struct({
  byteCount: Schema.Finite,
  digest: Schema.String,
  fileCount: Schema.Finite,
});
const quranEmbeddedSourceFields = {
  artifact: quranSourceArtifactValidator,
  kind: Schema.Literal("embedded"),
  label: Schema.String,
  notice: Schema.String,
  publisher: Schema.String,
  retrievedAt: Schema.String,
  sourceUrl: Schema.String,
  terms: Schema.Struct({
    artifact: quranSourceArtifactValidator,
    url: Schema.String,
  }),
  updateUrl: Schema.String,
  version: Schema.String,
};

/** Narrows embedded attribution to one Aksara-owned source identity. */
function embeddedSourceValidator<const SourceId extends QuranEmbeddedSourceId>(
  sourceId: SourceId
) {
  return Schema.Struct({
    ...quranEmbeddedSourceFields,
    id: Schema.Literal(sourceId),
  });
}
const quranExternalSourceFields = {
  kind: Schema.Literal("external"),
  label: Schema.String,
  notice: Schema.String,
  publisher: Schema.String,
  retrievedAt: Schema.String,
  sourceUrl: Schema.String,
  terms: Schema.Struct({
    access: Schema.Literal("link-only"),
    url: Schema.String,
  }),
  updateUrl: Schema.String,
  version: Schema.String,
};

/** Narrows external attribution to one Aksara-owned source identity. */
function externalSourceValidator<const SourceId extends QuranExternalSourceId>(
  sourceId: SourceId
) {
  return Schema.Struct({
    ...quranExternalSourceFields,
    id: Schema.Literal(sourceId),
  });
}
const quranArabicSourceValidator = embeddedSourceValidator(
  quranReadingSourceIds(ENGLISH_APP_LOCALE_CODE)[0]
);

/** Exact Arabic and locale-selected translation source relationships. */
export const quranReadingSourcesValidator = Schema.Union([
  Schema.Struct({
    arabic: quranArabicSourceValidator,
    translation: embeddedSourceValidator(
      quranTranslationSourceId(ENGLISH_APP_LOCALE_CODE)
    ),
  }),
  Schema.Struct({
    arabic: quranArabicSourceValidator,
    translation: embeddedSourceValidator(
      quranTranslationSourceId(INDONESIAN_APP_LOCALE_CODE)
    ),
  }),
  Schema.Struct({
    arabic: quranArabicSourceValidator,
    translation: embeddedSourceValidator(
      quranTranslationSourceId(GERMAN_APP_LOCALE_CODE)
    ),
  }),
]);

/** Semantic source-note relationship for one translated Quran verse. */
export const quranTranslationDocumentValidator = Schema.Struct({
  notes: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        number: Schema.Finite,
        referenceOffset: Schema.Finite,
        text: Schema.String,
      })
    )
  ),
  segments: Schema.mutable(
    Schema.Array(
      Schema.Union([
        Schema.Struct({
          kind: Schema.Literal("text"),
          offset: Schema.Finite,
          value: Schema.String,
        }),
        Schema.Struct({
          kind: Schema.Literal("note"),
          number: Schema.Finite,
          offset: Schema.Finite,
        }),
      ])
    )
  ),
});

/** Narrow signed Tafsir access projected to Quran page consumers. */
export const quranTafsirAccessValidator = Schema.Union([
  Schema.Struct({
    appLocale: Schema.Literal(INDONESIAN_APP_LOCALE_CODE),
    kind: Schema.Literal("embedded"),
    notice: Schema.String,
    source: embeddedSourceValidator(
      quranTafsirSourceId(INDONESIAN_APP_LOCALE_CODE)
    ),
  }),
  Schema.Struct({
    appLocale: Schema.Literal(ENGLISH_APP_LOCALE_CODE),
    kind: Schema.Literal("external"),
    notice: Schema.String,
    source: externalSourceValidator(
      quranTafsirSourceId(ENGLISH_APP_LOCALE_CODE)
    ),
  }),
  Schema.Struct({
    appLocale: Schema.Literal(GERMAN_APP_LOCALE_CODE),
    kind: Schema.Literal("external"),
    notice: Schema.String,
    source: externalSourceValidator(
      quranTafsirSourceId(GERMAN_APP_LOCALE_CODE)
    ),
  }),
]);

/** Exact public query arguments for a bounded Quran reference. */
export const quranReferenceArgsValidator = Schema.Struct({
  appLocale: quranAppLocaleValidator,
  fromVerse: Schema.Finite,
  surahNumber: Schema.Finite,
  toVerse: Schema.optionalKey(Schema.Finite),
});
export type QuranReferenceArgs = Schema.Schema.Type<
  typeof quranReferenceArgsValidator
>;

/** Shared active-source fields returned by every signed Quran read. */
export const quranSourceFields = {
  activeManifestHash: Schema.Union([Schema.String, Schema.Null]),
  activeReleaseId: Schema.Union([Schema.String, Schema.Null]),
  managed: Schema.Boolean,
  snapshotId: Schema.Union([Schema.String, Schema.Null]),
  sourceOrigin: Schema.Union([
    Schema.Struct({
      kind: Schema.Literal("git"),
      sha: Schema.String,
    }),
    Schema.Struct({
      kind: Schema.Literal("rollback"),
      releaseId: Schema.String,
    }),
    Schema.Null,
  ]),
  sourceRevision: Schema.Union([Schema.String, Schema.Null]),
};

/** Complete validator-owned source envelope shared by Quran projections. */
export const quranSourceValidator = Schema.Struct(quranSourceFields);
export type QuranSourceEnvelope = Schema.Schema.Type<
  typeof quranSourceValidator
>;
