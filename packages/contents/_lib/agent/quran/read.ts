import {
  getUnknownErrorMessage,
  NakafaAgentDataReadError,
  NakafaAgentInputError,
} from "@repo/contents/_lib/agent/errors";
import { parseNakafaContentRefFields } from "@repo/contents/_lib/agent/refs";
import {
  NakafaAgentQuranReferenceOptionsSchema,
  NakafaAgentQuranReferenceSchema,
} from "@repo/contents/_lib/agent/schema/quran";
import { getSurah, getSurahName } from "@repo/contents/_lib/quran";
import { Effect, Option, Schema } from "effect";

/** Retrieves bounded Quran verses with translation and optional tafsir. */
export const getNakafaAgentQuranReference = Effect.fn(
  "NakafaAgent.getQuranReference"
)(function* (
  options: unknown,
  loadSurah: typeof getSurah = getSurah,
  formatSurahName = getSurahName
) {
  const parsedOptions = yield* parseNakafaQuranOptions(options);
  const surah = yield* Effect.option(loadSurah(parsedOptions.surah));

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

  const ref = yield* parseNakafaContentRefFields(
    parsedOptions.locale,
    `quran/${surah.value.number}`,
    "quran"
  );

  const verses = surah.value.verses.flatMap((verse) => {
    const isInRange =
      verse.number.inSurah >= firstVerse && verse.number.inSurah <= lastVerse;

    if (!isInRange) {
      return [];
    }

    return [
      {
        arabic: verse.text.arab,
        number: verse.number.inSurah,
        ...(parsedOptions.include_tafsir
          ? { tafsir: verse.tafsir.id.short }
          : {}),
        translation: verse.translation[parsedOptions.locale],
        transliteration: verse.text.transliteration.en,
      },
    ];
  });

  if (verses.length === 0) {
    return Option.none();
  }

  const quranReference = yield* decodeNakafaAgentQuranReference({
    ...ref,
    name: formatSurahName({
      locale: parsedOptions.locale,
      name: surah.value.name,
    }),
    revelation: surah.value.revelation[parsedOptions.locale],
    translation: surah.value.name.translation[parsedOptions.locale],
    verses,
  });

  return Option.some(quranReference);
});

/** Decodes Quran reference output into the public agent schema shape. */
export function decodeNakafaAgentQuranReference(reference: unknown) {
  return Effect.try({
    try: () =>
      Schema.decodeUnknownSync(NakafaAgentQuranReferenceSchema)(reference),
    catch: (error) =>
      new NakafaAgentDataReadError({
        cause: getUnknownErrorMessage(error),
        message: "Unable to build Nakafa Quran reference.",
      }),
  });
}

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
