import type {
  AppLocaleCode,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import { parseQuranTranslation } from "@nakafa/aksara-contracts/quran/notes";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { releaseFail } from "@repo/backend/confect/contentRelease/error";
import { Array as Arr, Effect, Option } from "effect";

/** Reads the exact reviewed translation selected by one application locale. */
export const readQuranTranslation = Effect.fn(
  "contentRelease.readQuranTranslation"
)(function* (verse: QuranRuntimeVerse, appLocale: AppLocaleCode) {
  const localized = Option.getOrUndefined(
    Arr.findFirst(
      verse.translations,
      (translation) => translation.appLocale === appLocale
    )
  );
  if (!localized) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Quran verse ${verse.number.inQuran} has no ${appLocale} translation.`
    );
  }
  return localized.value;
});

/** Parses semantic notes after the signed row schema has verified consistency. */
export const readQuranTranslationDocument = Effect.fn(
  "contentRelease.readQuranTranslationDocument"
)(function* (verse: QuranRuntimeVerse, appLocale: AppLocaleCode) {
  const translation = yield* readQuranTranslation(verse, appLocale);
  const document = yield* parseQuranTranslation(translation).pipe(Effect.orDie);
  return {
    document: {
      notes: Arr.map(document.notes, ({ number, referenceOffset, text }) => ({
        number,
        referenceOffset,
        text,
      })),
      segments: Arr.map(document.segments, (segment) =>
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
    const localized = Option.getOrUndefined(
      Arr.findFirst(
        verse.tafsir,
        (interpretation) => interpretation.appLocale === appLocale
      )
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
