import type { AppLocaleCode } from "@nakafa/aksara-contracts/locale";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Reads the exact reviewed translation selected by one application locale. */
export const readQuranTranslation = Effect.fn(
  "contentRelease.readQuranTranslation"
)(function* (verse: QuranRuntimeVerse, appLocale: AppLocaleCode) {
  const localized = verse.translations.find(
    (translation) => translation.appLocale === appLocale
  );
  if (!localized) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran verse ${verse.number.inQuran} has no ${appLocale} translation.`
    );
  }
  return localized.value;
});

/** Reads the exact reviewed tafsir selected by its supported app locale. */
export const readQuranTafsir = Effect.fn("contentRelease.readQuranTafsir")(
  function* (verse: QuranRuntimeVerse, appLocale: "id") {
    const localized = verse.tafsir.find(
      (interpretation) => interpretation.appLocale === appLocale
    );
    if (!localized) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Quran verse ${verse.number.inQuran} has no ${appLocale} tafsir.`
      );
    }
    return localized;
  }
);
