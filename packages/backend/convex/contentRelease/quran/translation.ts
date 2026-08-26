import type {
  AppLocaleCode,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import { parseQuranTranslation } from "@nakafa/aksara-contracts/quran/notes";
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

/** Reads and parses the exact locale translation into semantic source notes. */
export const readQuranTranslationDocument = Effect.fn(
  "contentRelease.readQuranTranslationDocument"
)(function* (verse: QuranRuntimeVerse, appLocale: AppLocaleCode) {
  const translation = yield* readQuranTranslation(verse, appLocale);
  const document = yield* parseQuranTranslation(translation).pipe(
    Effect.catchTag("QuranTranslationNotesError", () =>
      releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Quran verse ${verse.number.inQuran} has inconsistent ${appLocale} translation notes.`
      )
    )
  );
  return {
    document: {
      notes: document.notes.map(({ number, referenceOffset, text }) => ({
        number,
        referenceOffset,
        text,
      })),
      segments: document.segments.map((segment) =>
        segment.kind === "text"
          ? {
              kind: segment.kind,
              offset: segment.offset,
              value: segment.value,
            }
          : {
              kind: segment.kind,
              number: segment.number,
              offset: segment.offset,
            }
      ),
    },
    translation,
  };
});

/** Reads the exact reviewed tafsir selected by its supported app locale. */
export const readQuranTafsir = Effect.fn("contentRelease.readQuranTafsir")(
  function* (
    verse: QuranRuntimeVerse,
    appLocale: typeof INDONESIAN_APP_LOCALE_CODE
  ) {
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
