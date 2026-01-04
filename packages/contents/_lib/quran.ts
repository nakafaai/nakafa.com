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

const SURAH_COUNT = 114;
const VERSE_COUNT = 286;
const JUZ_COUNT = 30;

/**
 * Get a surah by its id, id is 1-114
 * @param id - The id of the surah
 * @returns Effect that resolves to the surah, or fails with SurahNotFoundError
 */
export const getSurah = (
  id: number
): Effect.Effect<Surah, SurahNotFoundError> =>
  Effect.gen(function* () {
    if (id < 1 || id > SURAH_COUNT) {
      return yield* Effect.fail(new SurahNotFoundError({ surahNumber: id }));
    }

    const surah = quran[id - 1];
    const result = SurahSchema.safeParse(surah);
    if (!result.success) {
      return yield* Effect.fail(new SurahNotFoundError({ surahNumber: id }));
    }

    return result.data;
  });

/**
 * Validates and extracts surah data without verses for memory efficiency.
 * Uses schema validation to ensure data integrity.
 *
 * @param surah - Unknown data to validate
 * @returns Validated surah data without verses as Option
 *
 * @example
 * ```ts
 * const surahData = validateSurahWithoutVerses(rawData);
 * ```
 */
export const validateSurahWithoutVerses = (
  surah: unknown
): Option.Option<Omit<Surah, "verses">> =>
  Option.fromNullable(SurahSchema.omit({ verses: true }).safeParse(surah).data);

/**
 * Get all surahs without verses to reduce memory usage
 * @returns All surahs without verses
 */
export const getAllSurah = (): Omit<Surah, "verses">[] =>
  quran
    .map(validateSurahWithoutVerses)
    .filter(Option.isSome)
    .map((option) => option.value);

/**
 * Get all verses by juz, juz is 1-30
 * @param juz - The juz to get the verses for
 * @returns The verses for the juz
 */
export const getVersesByJuz = (juz: number): Verse[] => {
  if (juz < 1 || juz > JUZ_COUNT) {
    return [];
  }

  return quran
    .flatMap((surah) => surah.verses)
    .filter((verse) => verse.meta.juz === juz);
};

/**
 * Get a verse by surah and verse number
 * @param surah - The surah to get the verse for, surah is 1-114
 * @param verse - The verse number to get, verse is 1-286
 * @returns Effect that resolves to the verse, or fails with SurahNotFoundError or VerseNotFoundError
 */
export const getVerseBySurah = ({
  surah: surahNum,
  verse: verseNum,
}: {
  surah: number;
  verse: number;
}): Effect.Effect<Verse, SurahNotFoundError | VerseNotFoundError> =>
  Effect.gen(function* () {
    if (surahNum < 1 || surahNum > SURAH_COUNT) {
      return yield* Effect.fail(
        new SurahNotFoundError({ surahNumber: surahNum })
      );
    }

    if (verseNum < 1 || verseNum > VERSE_COUNT) {
      return yield* Effect.fail(
        new VerseNotFoundError({
          surahNumber: surahNum,
          verseNumber: verseNum,
        })
      );
    }

    const surah = yield* getSurah(surahNum);
    const verse = surah.verses[verseNum - 1];

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

/**
 * Get the name of a surah in a given locale
 * @param locale - The locale to get the name in
 * @param name - The surah name object
 * @returns The name of the surah in the given locale
 */
export const getSurahName = ({
  locale,
  name,
}: {
  locale: string;
  name: Surah["name"];
}): string =>
  pipe(
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
