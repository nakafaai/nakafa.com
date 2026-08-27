import {
  type AppLocaleCode,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import {
  quranReadingSourceIds,
  quranTafsirSourceId,
} from "@nakafa/aksara-contracts/quran/identity";
import type {
  quranReadingSourcesValidator,
  quranTafsirAccessValidator,
} from "@repo/backend/convex/contentRelease/quran/spec";
import type { Infer } from "convex/values";

type QuranReadingSources = Infer<typeof quranReadingSourcesValidator>;
type QuranTafsirAccess = Infer<typeof quranTafsirAccessValidator>;

/** Checks that one response carries the exact signed sources for its locale. */
export function hasExpectedQuranSources(
  sources: null | QuranReadingSources,
  tafsirAccess: null | QuranTafsirAccess,
  appLocale: AppLocaleCode
): sources is QuranReadingSources {
  if (sources === null) {
    return false;
  }
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
  if (tafsirAccess === null) {
    return appLocale !== INDONESIAN_APP_LOCALE_CODE;
  }
  return (
    tafsirAccess.appLocale === appLocale &&
    tafsirAccess.source.id === quranTafsirSourceId(appLocale) &&
    tafsirAccess.source.kind === tafsirAccess.kind
  );
}
