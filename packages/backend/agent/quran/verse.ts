import {
  type AppLocaleCode,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import { parseQuranTranslation } from "@nakafa/aksara-contracts/quran/notes";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { NakafaAgentDataReadError } from "@repo/contents/_lib/agent/errors";
import { Effect } from "effect";

/** Reads one exact locale-selected signed translation. */
const readTranslation = Effect.fn("agent.quran.readTranslation")(function* (
  verse: QuranRuntimeVerse,
  appLocale: AppLocaleCode
) {
  const localized = verse.translations.find(
    (translation) => translation.appLocale === appLocale
  );
  if (!localized) {
    return yield* referenceError(
      `Signed Quran verse ${verse.number.inQuran} has no ${appLocale} translation.`
    );
  }
  return localized.value;
});

/** Projects one verse into the immutable V1 wire shape. */
export const projectQuranVerseV1 = Effect.fn("agent.quran.projectVerseV1")(
  function* (
    verse: QuranRuntimeVerse,
    appLocale: AppLocaleCode,
    includeTafsir: boolean
  ) {
    const row = {
      arabic: verse.text.arabic,
      number: verse.number.inSurah,
      translation: (yield* readTranslation(verse, appLocale)).text,
    };
    const tafsir = yield* readRequestedTafsir(verse, appLocale, includeTafsir);
    return tafsir === undefined ? row : { ...row, tafsir };
  }
);

/** Projects one verse into semantic V2 translation-note fields. */
export const projectQuranVerseV2 = Effect.fn("agent.quran.projectVerseV2")(
  function* (
    verse: QuranRuntimeVerse,
    appLocale: AppLocaleCode,
    includeTafsir: boolean
  ) {
    const source = yield* readTranslation(verse, appLocale);
    const translation = yield* parseQuranTranslation(source).pipe(
      Effect.mapError(
        (error) =>
          new NakafaAgentDataReadError({
            cause: `Signed Quran verse ${verse.number.inQuran} has inconsistent translation notes: ${error.reason}.`,
            message: "Unable to read signed Nakafa Quran reference.",
          })
      )
    );
    const row = {
      arabic: verse.text.arabic,
      number: verse.number.inSurah,
      translation,
    };
    const tafsir = yield* readRequestedTafsir(verse, appLocale, includeTafsir);
    return tafsir === undefined ? row : { ...row, tafsir };
  }
);

/** Returns only requested embedded Indonesian tafsir text. */
const readRequestedTafsir = Effect.fn("agent.quran.readRequestedTafsir")(
  function* (
    verse: QuranRuntimeVerse,
    appLocale: AppLocaleCode,
    includeTafsir: boolean
  ) {
    if (!(includeTafsir && appLocale === INDONESIAN_APP_LOCALE_CODE)) {
      return;
    }
    const tafsir = verse.tafsir.find(
      (interpretation) => interpretation.appLocale === appLocale
    );
    if (!tafsir) {
      return yield* referenceError(
        `Signed Quran verse ${verse.number.inQuran} has no Indonesian tafsir.`
      );
    }
    return tafsir.text;
  }
);

/** Creates one typed signed-reference integrity failure. */
function referenceError(cause: string) {
  return new NakafaAgentDataReadError({
    cause,
    message: "Unable to read signed Nakafa Quran reference.",
  });
}
