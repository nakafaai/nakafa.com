import { quran } from "@repo/contents/_data/quran";
import {
  SurahNotFoundError,
  VerseNotFoundError,
} from "@repo/contents/_shared/error";
import {
  type Surah,
  SurahSchema,
  type Verse,
} from "@repo/contents/_types/quran";
import { Effect, Option, pipe } from "effect";
import type { Locale } from "next-intl";

const verses = quran.flatMap((surah) => surah.verses);

/** Checks whether a route number can identify Quran data. */
function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

/**
 * Retrieves a surah by its Quran number.
 *
 * @param id - Surah number from the available Quran data
 * @returns Effect that resolves to the validated surah or fails when missing
 */
export function getSurah(id: number): Effect.Effect<Surah, SurahNotFoundError> {
  return Effect.gen(function* () {
    if (!isPositiveInteger(id)) {
      return yield* Effect.fail(new SurahNotFoundError({ surahNumber: id }));
    }

    const surah = quran.find((item) => item.number === id);
    const result = SurahSchema.safeParse(surah);
    if (!result.success) {
      return yield* Effect.fail(new SurahNotFoundError({ surahNumber: id }));
    }

    return result.data;
  });
}

/**
 * Validates a surah value and strips its verses for lightweight listing usage.
 *
 * @param surah - Unknown data to validate
 * @returns Validated surah metadata without verses when parsing succeeds
 *
 * @example
 * ```ts
 * const surahData = validateSurahWithoutVerses(rawData);
 * ```
 */
export function validateSurahWithoutVerses(
  surah: unknown
): Option.Option<Omit<Surah, "verses">> {
  return Option.fromNullable(
    SurahSchema.omit({ verses: true }).safeParse(surah).data
  );
}

/**
 * Returns all validated surahs without verse payloads.
 *
 * @returns Lightweight surah list for indexes and navigation UIs
 */
export function getAllSurah(): Omit<Surah, "verses">[] {
  return quran
    .map(validateSurahWithoutVerses)
    .filter(Option.isSome)
    .map((option) => option.value);
}

/**
 * Returns all verses that belong to a juz.
 *
 * @param juz - Juz number from the available Quran data
 * @returns All verses in the juz, or an empty array for invalid input
 */
export function getVersesByJuz(juz: number): Verse[] {
  if (!isPositiveInteger(juz)) {
    return [];
  }

  return verses.filter((verse) => verse.meta.juz === juz);
}

/**
 * Retrieves a verse by surah number and verse number.
 *
 * @param surah - Surah number from the available Quran data
 * @param verse - Verse number validated against the selected surah
 * @returns Effect that resolves to the verse or fails with a not-found error
 */
export function getVerseBySurah({
  surah: surahNum,
  verse: verseNum,
}: {
  surah: number;
  verse: number;
}): Effect.Effect<Verse, SurahNotFoundError | VerseNotFoundError> {
  return Effect.gen(function* () {
    if (!isPositiveInteger(verseNum)) {
      return yield* Effect.fail(
        new VerseNotFoundError({
          surahNumber: surahNum,
          verseNumber: verseNum,
        })
      );
    }

    const surah = yield* getSurah(surahNum);
    const verse = surah.verses.find((item) => item.number.inSurah === verseNum);

    if (!verse) {
      return yield* Effect.fail(
        new VerseNotFoundError({
          surahNumber: surahNum,
          verseNumber: verseNum,
        })
      );
    }

    return verse;
  });
}

/**
 * Resolves the most appropriate localized surah name for a locale.
 *
 * The transliteration is preferred first, then the translation, and finally the
 * long Arabic-derived name if no localized variant exists.
 *
 * @param locale - Locale used to select the display name
 * @param name - Surah name payload from Quran data
 * @returns Best available name for the requested locale
 */
export function getSurahName({
  locale,
  name,
}: {
  locale: Locale;
  name: Surah["name"];
}): string {
  return pipe(
    Object.entries(name.transliteration).find(([key]) => key === locale),
    Option.fromNullable,
    Option.map(([, value]) => value),
    Option.orElse(() =>
      pipe(
        Object.entries(name.translation).find(([key]) => key === locale),
        Option.fromNullable,
        Option.map(([, value]) => value)
      )
    ),
    Option.getOrElse(() => name.long)
  );
}
