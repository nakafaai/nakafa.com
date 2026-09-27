import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { QuranSnapshotRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QuranAttributionRowSchema } from "@nakafa/aksara-contracts/quran/source";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import {
  quranAppLocaleValidator,
  quranReadingSourcesValidator,
  quranRevelationPlaceValidator,
  quranSourceFields,
  quranSurahMeaningValidator,
  quranTafsirAccessValidator,
  quranTranslationDocumentValidator,
} from "@repo/backend/confect/contentRelease/quran/spec";
import { Schema } from "effect";

/** Current signed attribution contract served by the active Quran snapshot. */
export const PublishedQuranAttributionSchema = QuranAttributionRowSchema;
export type PublishedQuranAttribution =
  typeof PublishedQuranAttributionSchema.Type;

/** Complete localized meaning map served by the active Quran snapshot. */
export const PublishedQuranMeaningSchema =
  QuranSurahRowSchema.fields.name.fields.meaning;
export type PublishedQuranMeaning = typeof PublishedQuranMeaningSchema.Type;

/** Current signed surah contract served by the active Quran snapshot. */
export const PublishedQuranSurahSchema = QuranSurahRowSchema;
export type PublishedQuranSurah = typeof PublishedQuranSurahSchema.Type;

/** Current signed Quran row envelope stored by the active snapshot. */
export const PublishedQuranRowSchema = Schema.Struct({
  family: Schema.Literal("quran"),
  record: QuranSnapshotRowSchema,
});
export type PublishedQuranRow = typeof PublishedQuranRowSchema.Type;

/** Selects the reviewed meaning for one active application locale. */
export function selectQuranMeaning(
  meaning: PublishedQuranMeaning,
  appLocale: AppLocaleCode
) {
  return {
    appLocale,
    text: meaning[appLocale],
  };
}

/** Formats the reviewed meaning for one active application locale. */
export function formatQuranMeaning(
  meaning: PublishedQuranMeaning,
  appLocale: AppLocaleCode
) {
  return meaning[appLocale];
}
/** Exact signed Bismillah presentation projected from Al-Fatihah verse 1. */
export const quranBismillahValidator = Schema.Struct({
  arabic: Schema.String,
  translation: quranTranslationDocumentValidator,
});

/** Reads one locale's canonical Bismillah from authenticated source rows. */

export const quranMarkdownSurahValidator = Schema.Struct({
  name: Schema.Struct({
    arabic: Schema.String,
    sourceMeaning: quranSurahMeaningValidator,
    transliteration: Schema.String,
  }),
  number: Schema.Finite,
  numberOfVerses: Schema.Finite,
  revelation: Schema.Struct({
    place: quranRevelationPlaceValidator,
  }),
});
export const quranMarkdownVerseValidator = Schema.Struct({
  arabic: Schema.String,
  number: Schema.Struct({
    inSurah: Schema.Finite,
  }),
  translation: quranTranslationDocumentValidator,
});

/** Exact signed fields needed to render app-locale Quran markdown. */
export const quranMarkdownValidator = Schema.Struct({
  ...quranSourceFields,
  appLocale: quranAppLocaleValidator,
  preBismillah: Schema.Union([quranBismillahValidator, Schema.Null]),
  sources: Schema.Union([quranReadingSourcesValidator, Schema.Null]),
  surah: Schema.Union([quranMarkdownSurahValidator, Schema.Null]),
  tafsirAccess: Schema.Union([quranTafsirAccessValidator, Schema.Null]),
  toVerse: Schema.Finite,
  verses: Schema.mutable(Schema.Array(quranMarkdownVerseValidator)),
});
export type QuranMarkdown = Schema.Schema.Type<typeof quranMarkdownValidator>;
