import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { buildNakafaContentRef } from "@repo/contents/_lib/agent/refs";
import {
  NakafaAgentQuranReferenceOptionsSchema,
  NakafaAgentQuranReferenceSchema,
} from "@repo/contents/_lib/agent/schema/quran";
import { getSurah, getSurahName } from "@repo/contents/_lib/quran";
import { Effect, Option, Schema } from "effect";

/** Retrieves bounded Quran verses with translation and optional tafsir. */
export const getNakafaAgentQuranReference = Effect.fn(
  "NakafaAgent.getQuranReference"
)(function* (options: unknown) {
  const parsedOptions = yield* parseNakafaQuranOptions(options);
  const surah = yield* Effect.option(getSurah(parsedOptions.surah));

  if (Option.isNone(surah)) {
    return Option.none();
  }

  const firstVerse = parsedOptions.from_verse;
  const lastVerse = parsedOptions.to_verse ?? firstVerse;

  if (lastVerse < firstVerse) {
    return Option.none();
  }

  if (lastVerse > surah.value.numberOfVerses) {
    return Option.none();
  }

  const ref = buildNakafaContentRef(
    parsedOptions.locale,
    `quran/${surah.value.number}`,
    "quran"
  );
  const verses = surah.value.verses
    .filter(
      (verse) =>
        verse.number.inSurah >= firstVerse && verse.number.inSurah <= lastVerse
    )
    .map((verse) => ({
      arabic: verse.text.arab,
      number: verse.number.inSurah,
      ...(parsedOptions.include_tafsir
        ? { tafsir: verse.tafsir.id.short }
        : {}),
      translation: verse.translation[parsedOptions.locale],
      transliteration: verse.text.transliteration.en,
    }));

  if (verses.length === 0) {
    return Option.none();
  }

  const quranReference = yield* Effect.try({
    try: () =>
      Schema.decodeUnknownSync(NakafaAgentQuranReferenceSchema)({
        ...ref,
        name: getSurahName({
          locale: parsedOptions.locale,
          name: surah.value.name,
        }),
        revelation: surah.value.revelation[parsedOptions.locale],
        translation: surah.value.name.translation[parsedOptions.locale],
        verses,
      }),
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: "Unable to build Nakafa Quran reference.",
      }),
  });

  return Option.some(quranReference);
});

/** Parses Quran reference input with actionable Effect errors. */
function parseNakafaQuranOptions(options: unknown) {
  return Effect.try({
    try: () =>
      Schema.decodeUnknownSync(NakafaAgentQuranReferenceOptionsSchema)(options),
    catch: (error) =>
      new NakafaAgentInputError({
        cause: getUnknownErrorMessage(error),
        message: "Invalid Nakafa Quran reference options.",
      }),
  });
}
