import {
  APP_LOCALE_CODES,
  ENGLISH_APP_LOCALE_CODE,
  GERMAN_APP_LOCALE_CODE,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import {
  type QuranEmbeddedSourceId,
  QuranEmbeddedSourceIdSchema,
  type QuranExternalSourceId,
  QuranExternalSourceIdSchema,
  quranReadingSourceIds,
  quranTafsirSourceId,
  quranTranslationSourceId,
} from "@nakafa/aksara-contracts/quran/identity";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import { type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Runtime validator for every application locale supported by Quran reads. */
export const quranAppLocaleValidator = literals(...APP_LOCALE_CODES);

/** Runtime validator for app locales with a complete signed tafsir source. */
export const quranTafsirAppLocaleValidator = literals(
  INDONESIAN_APP_LOCALE_CODE
);

/** Runtime validator derived from the signed revelation-place contract. */
export const quranRevelationPlaceValidator = literals(
  ...QuranSurahRowSchema.fields.revelation.fields.place.literals
);

/** Complete locale-keyed meanings retained from the signed surah metadata row. */
export const quranSurahMeaningValidator = v.object({
  de: v.string(),
  en: v.string(),
  id: v.string(),
});

const quranSourceArtifactValidator = v.object({
  byteCount: v.number(),
  digest: v.string(),
  fileCount: v.number(),
});

const quranEmbeddedSourceFields = {
  artifact: quranSourceArtifactValidator,
  kind: v.literal("embedded"),
  label: v.string(),
  notice: v.string(),
  publisher: v.string(),
  retrievedAt: v.string(),
  sourceUrl: v.string(),
  terms: v.object({
    artifact: quranSourceArtifactValidator,
    url: v.string(),
  }),
  updateUrl: v.string(),
  version: v.string(),
};

/** Narrows embedded attribution to one Aksara-owned source identity. */
function embeddedSourceValidator<const SourceId extends QuranEmbeddedSourceId>(
  sourceId: SourceId
) {
  return v.object({
    ...quranEmbeddedSourceFields,
    id: v.literal(sourceId),
  });
}

/** Signed metadata for one embedded official Quran source. */
export const quranEmbeddedSourceValidator = v.object({
  ...quranEmbeddedSourceFields,
  id: literals(...QuranEmbeddedSourceIdSchema.literals),
});

const quranExternalSourceFields = {
  kind: v.literal("external"),
  label: v.string(),
  notice: v.string(),
  publisher: v.string(),
  retrievedAt: v.string(),
  sourceUrl: v.string(),
  terms: v.object({ access: v.literal("link-only"), url: v.string() }),
  updateUrl: v.string(),
  version: v.string(),
};

/** Narrows external attribution to one Aksara-owned source identity. */
function externalSourceValidator<const SourceId extends QuranExternalSourceId>(
  sourceId: SourceId
) {
  return v.object({
    ...quranExternalSourceFields,
    id: v.literal(sourceId),
  });
}

/** Signed metadata for one official Quran source that remains link-only. */
export const quranExternalSourceValidator = v.object({
  ...quranExternalSourceFields,
  id: literals(...QuranExternalSourceIdSchema.literals),
});

/** Full signed source metadata exposed to Quran consumers. */
export const quranContentSourceValidator = v.union(
  quranEmbeddedSourceValidator,
  quranExternalSourceValidator
);

const quranArabicSourceValidator = embeddedSourceValidator(
  quranReadingSourceIds(ENGLISH_APP_LOCALE_CODE)[0]
);

/** Exact Arabic and locale-selected translation source relationships. */
export const quranReadingSourcesValidator = v.union(
  v.object({
    arabic: quranArabicSourceValidator,
    translation: embeddedSourceValidator(
      quranTranslationSourceId(ENGLISH_APP_LOCALE_CODE)
    ),
  }),
  v.object({
    arabic: quranArabicSourceValidator,
    translation: embeddedSourceValidator(
      quranTranslationSourceId(INDONESIAN_APP_LOCALE_CODE)
    ),
  }),
  v.object({
    arabic: quranArabicSourceValidator,
    translation: embeddedSourceValidator(
      quranTranslationSourceId(GERMAN_APP_LOCALE_CODE)
    ),
  })
);

/** Semantic source-note relationship for one translated Quran verse. */
export const quranTranslationDocumentValidator = v.object({
  notes: v.array(
    v.object({
      number: v.number(),
      referenceOffset: v.number(),
      text: v.string(),
    })
  ),
  segments: v.array(
    v.union(
      v.object({
        kind: v.literal("text"),
        offset: v.number(),
        value: v.string(),
      }),
      v.object({
        kind: v.literal("note"),
        number: v.number(),
        offset: v.number(),
      })
    )
  ),
});

/** Narrow signed Tafsir access projected to Quran page consumers. */
export const quranTafsirAccessValidator = v.union(
  v.object({
    appLocale: v.literal(INDONESIAN_APP_LOCALE_CODE),
    kind: v.literal("embedded"),
    notice: v.string(),
    source: embeddedSourceValidator(
      quranTafsirSourceId(INDONESIAN_APP_LOCALE_CODE)
    ),
  }),
  v.object({
    appLocale: v.literal(ENGLISH_APP_LOCALE_CODE),
    kind: v.literal("external"),
    notice: v.string(),
    source: externalSourceValidator(
      quranTafsirSourceId(ENGLISH_APP_LOCALE_CODE)
    ),
  }),
  v.object({
    appLocale: v.literal(GERMAN_APP_LOCALE_CODE),
    kind: v.literal("external"),
    notice: v.string(),
    source: externalSourceValidator(
      quranTafsirSourceId(GERMAN_APP_LOCALE_CODE)
    ),
  })
);

/** Exact public query arguments for a bounded Quran reference. */
export const quranReferenceArgsValidator = v.object({
  appLocale: quranAppLocaleValidator,
  fromVerse: v.number(),
  surahNumber: v.number(),
  toVerse: v.optional(v.number()),
});
export type QuranReferenceArgs = Infer<typeof quranReferenceArgsValidator>;

/** Shared active-source fields returned by every signed Quran read. */
export const quranSourceFields = {
  activeManifestHash: v.union(v.string(), v.null()),
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  snapshotId: v.union(v.string(), v.null()),
  sourceOrigin: v.union(
    v.object({ kind: v.literal("git"), sha: v.string() }),
    v.object({ kind: v.literal("rollback"), releaseId: v.string() }),
    v.null()
  ),
  sourceRevision: v.union(v.string(), v.null()),
};

/** Complete validator-owned source envelope shared by Quran projections. */
export const quranSourceValidator = v.object(quranSourceFields);
export type QuranSourceEnvelope = Infer<typeof quranSourceValidator>;
