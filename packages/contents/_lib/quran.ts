import { quran } from "@repo/contents/_data/quran";
import {
  type Surah,
  SurahSchema,
  type Verse,
} from "@repo/contents/_types/quran";

const SURAH_COUNT = 114;
const VERSE_COUNT = 286;
const JUZ_COUNT = 30;

/**
 * Get a surah by its id, id is 1-114
 * @param id - The id of the surah
 * @returns The surah or null if the surah is not found
 */
export function getSurah(id: number): Surah | null {
  // validate input
  if (id < 1 || id > SURAH_COUNT) {
    return null;
  }

  // id is index of surah, so we can get O(1)
  const surah = quran[id - 1];
  const { data } = SurahSchema.safeParse(surah);
  if (!data) {
    return null;
  }
  return data;
}

/**
 * Get all surahs without verses to reduce memory usage
 * @returns All surahs without verses
 */
export function getAllSurah(): Omit<Surah, "verses">[] {
  // if no id is provided, return all surah, but without verses
  return quran
    .map((surah) => {
      const { data } = SurahSchema.omit({
        verses: true,
      }).safeParse(surah);
      if (!data) {
        return null;
      }
      return data;
    })
    .filter((surah) => surah !== null);
}

/**
 * Get all verses by juz, juz is 1-30
 * @param juz - The juz to get the verses for
 * @returns The verses for the juz
 */
export function getVersesByJuz(juz: number): Verse[] {
  // juz is 1-30, validate input
  if (juz < 1 || juz > JUZ_COUNT) {
    return [];
  }

  // O(n) - flatten and filter all verses
  return quran
    .flatMap((surah) => surah.verses)
    .filter((verse) => verse.meta.juz === juz);
}

/**
 * Get a verse by surah and verse number
 * @param surah - The surah to get the verse for, surah is 1-114
 * @param verse - The verse number to get, verse is 1-286
 * @returns The verse or null if the verse is not found
 */
export function getVerseBySurah({
  surah,
  verse,
}: {
  surah: number;
  verse: number;
}): Verse | null {
  // validate input
  if (surah < 1 || surah > SURAH_COUNT) {
    return null;
  }

  if (verse < 1 || verse > VERSE_COUNT) {
    return null;
  }

  // get the surah
  const surahData = getSurah(surah);
  if (!surahData) {
    return null;
  }

  // get the verse
  const verseData = surahData.verses[verse - 1];
  return verseData;
}

/**
 * Get the name of a surah in a given locale
 * @param locale - The locale to get the name in
 * @param surah - The surah to get the name for
 * @returns The name of the surah in the given locale
 */
export function getSurahName({
  locale,
  name,
}: {
  locale:
    | keyof Surah["name"]["transliteration"]
    | keyof Surah["name"]["translation"];
  name: Surah["name"];
}) {
  return name.transliteration[locale] ?? name.translation[locale] ?? name.long;
}
