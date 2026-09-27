import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import {
  quranReadingSourceIds,
  quranTafsirSourceId,
} from "@nakafa/aksara-contracts/quran/identity";
import type {
  quranReadingSourcesValidator,
  quranTafsirAccessValidator,
} from "@repo/backend/confect/contentRelease/quran/spec";
import type { Schema } from "effect";

type QuranReadingSources = Schema.Schema.Type<
  typeof quranReadingSourcesValidator
>;
type QuranTafsirAccess = Schema.Schema.Type<typeof quranTafsirAccessValidator>;

/** Checks that one response carries the exact signed sources for its locale. */
export function hasExpectedQuranSources(
  sources: QuranReadingSources,
  tafsirAccess: QuranTafsirAccess,
  appLocale: AppLocaleCode
) {
  const [arabicSourceId, translationSourceId] =
    quranReadingSourceIds(appLocale);
  if (
    sources.arabic.id !== arabicSourceId ||
    sources.arabic.kind !== "embedded" ||
    sources.translation.id !== translationSourceId ||
    sources.translation.kind !== "embedded"
  ) {
    return false;
  }
  return (
    tafsirAccess.appLocale === appLocale &&
    tafsirAccess.source.id === quranTafsirSourceId(appLocale) &&
    tafsirAccess.source.kind === tafsirAccess.kind
  );
}
