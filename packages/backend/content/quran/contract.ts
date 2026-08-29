import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { QuranSnapshotRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QuranAttributionRowSchema } from "@nakafa/aksara-contracts/quran/source";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
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
  return { appLocale, text: meaning[appLocale] };
}

/** Formats the reviewed meaning for one active application locale. */
export function formatQuranMeaning(
  meaning: PublishedQuranMeaning,
  appLocale: AppLocaleCode
) {
  return meaning[appLocale];
}
