import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import { QuranSnapshotRowSchema } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { QuranSnapshotSchema } from "@nakafa/aksara-contracts/quran/snapshot/spec";
import { QuranSurahRowSchema } from "@nakafa/aksara-contracts/quran/spec";
import { QuranSnapshotRowSchema as TransitionQuranSnapshotRowSchema } from "@nakafa/aksara-transition/quran/snapshot/row";
import { QuranSnapshotSchema as TransitionQuranSnapshotSchema } from "@nakafa/aksara-transition/quran/snapshot/spec";
import { QuranSurahRowSchema as TransitionQuranSurahRowSchema } from "@nakafa/aksara-transition/quran/spec";
import { Schema } from "effect";

/** Exact signed surah meanings accepted during the bounded data switch. */
export const PublishedQuranMeaningSchema = Schema.Union([
  QuranSurahRowSchema.fields.name.fields.meaning,
  TransitionQuranSurahRowSchema.fields.name.fields.meaning,
]);
export type PublishedQuranMeaning = typeof PublishedQuranMeaningSchema.Type;

/** Exact signed surah contracts accepted during the bounded data switch. */
export const PublishedQuranSurahSchema = Schema.Union([
  QuranSurahRowSchema,
  TransitionQuranSurahRowSchema,
]);
export type PublishedQuranSurah = typeof PublishedQuranSurahSchema.Type;

/** Exact signed Quran row envelopes accepted during the bounded data switch. */
export const PublishedQuranRowSchema = Schema.Struct({
  family: Schema.Literal("quran"),
  record: Schema.Union([
    QuranSnapshotRowSchema,
    TransitionQuranSnapshotRowSchema,
  ]),
});
export type PublishedQuranRow = typeof PublishedQuranRowSchema.Type;

/** Exact signed Quran manifests accepted during the bounded data switch. */
export const PublishedQuranManifestSchema = Schema.Struct({
  family: Schema.Literal("quran"),
  manifest: Schema.Union([QuranSnapshotSchema, TransitionQuranSnapshotSchema]),
});
export type PublishedQuranManifest = typeof PublishedQuranManifestSchema.Type;

/** Selects a truthful localized meaning without relabeling predecessor English. */
export function selectQuranMeaning(
  meaning: PublishedQuranMeaning,
  appLocale: AppLocaleCode
) {
  if ("appLocale" in meaning) {
    return { appLocale: meaning.appLocale, text: meaning.text };
  }
  return { appLocale, text: meaning[appLocale] };
}
