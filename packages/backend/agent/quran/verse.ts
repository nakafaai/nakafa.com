import {
  type AppLocaleCode,
  INDONESIAN_APP_LOCALE_CODE,
} from "@nakafa/aksara-contracts/locale";
import { parseQuranTranslation } from "@nakafa/aksara-contracts/quran/notes";
import type { QuranRuntimeVerse } from "@nakafa/aksara-contracts/quran/snapshot/row";
import { NakafaAgentDataReadError } from "@repo/contents/agent/errors";
import { Array as Arr, Effect, Option } from "effect";

/** Reads one exact locale-selected signed translation. */
const readTranslation = Effect.fn("agent.quran.readTranslation")(function* (
  verse: QuranRuntimeVerse,
  appLocale: AppLocaleCode
) {
  const localized = Arr.findFirst(
    verse.translations,
    (translation) => translation.appLocale === appLocale
  );
  if (Option.isNone(localized)) {
    return yield* referenceError(
      `Signed Quran verse ${verse.number.inQuran} has no ${appLocale} translation.`
    );
  }
  return localized.value.value;
});

/** Projects one verse into semantic translation-note fields. */
export const projectQuranVerse = Effect.fn("agent.quran.projectVerse")(
  function* (
    verse: QuranRuntimeVerse,
    appLocale: AppLocaleCode,
    includeTafsir: boolean
  ) {
    const source = yield* readTranslation(verse, appLocale);
    const translation = yield* parseQuranTranslation(source).pipe(
      Effect.mapError((error) =>
        NakafaAgentDataReadError.make({
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
    return tafsir === undefined
      ? row
      : {
          ...row,
          tafsir,
        };
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
    const tafsir = Arr.findFirst(
      verse.tafsir,
      (interpretation) => interpretation.appLocale === appLocale
    );
    if (Option.isNone(tafsir)) {
      return yield* referenceError(
        `Signed Quran verse ${verse.number.inQuran} has no Indonesian tafsir.`
      );
    }
    return tafsir.value.text;
  }
);

/** Creates one typed signed-reference integrity failure. */
function referenceError(cause: string) {
  return NakafaAgentDataReadError.make({
    cause,
    message: "Unable to read signed Nakafa Quran reference.",
  });
}
