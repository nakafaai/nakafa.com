import { quran } from "@repo/contents/_data/quran";
import {
  type Surah,
  SurahSchema,
  type Verse,
} from "@repo/contents/_types/quran";

/**
 * Get a surah by its id, id is 1-114
 * @param id - The id of the surah
 * @returns The surah or null if the surah is not found
 */
export function getSurah(id: number): Surah | null {
  // validate input
  if (id < 1 || id > 114) {
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
  if (juz < 1 || juz > 30) {
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
  if (surah < 1 || surah > 114) {
    return null;
  }

  if (verse < 1 || verse > 286) {
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
