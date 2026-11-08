import { Array as Arr, Schema } from "effect";

/** One surah of the Quran index: its number, its two names, and the meaning of its name in the page's language. */
export const QuranIndexSurah = Schema.Struct({
  arabic: Schema.String,
  meaning: Schema.String,
  number: Schema.Int,
  title: Schema.String,
});

/** A letter written more than once in a row, which a search counts once. */
const REPEATED_LETTER = /(?<letter>\p{L})\k<letter>+/gu;

/** A closing "h" after a vowel, which readers add or leave out. */
const CLOSING_H = /(?<vowel>[aeiou])h$/u;

/**
 * Words as a search compares them: lower case, with no marks, so Arabic without
 * its vowel signs and a name without its accents still match, and with no space,
 * dash or apostrophe. A doubled letter counts once and a closing "h" after a
 * vowel not at all, so the spellings readers use for one name meet: "al baqarah"
 * and "Al-Baqara", "fatihah" and "Al-Faatiha".
 */
function fold(words: string) {
  return words
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "")
    .replace(REPEATED_LETTER, "$<letter>")
    .replace(CLOSING_H, "$<vowel>");
}

/**
 * The surahs a search keeps, in their order: every surah while the search is
 * empty, and otherwise each surah whose number starts with the search or whose
 * transliterated name, Arabic name or meaning holds it.
 */
export function searchSurahs(
  search: string,
  surahs: readonly (typeof QuranIndexSurah.Type)[]
) {
  const wanted = fold(search);
  if (wanted === "") {
    return surahs;
  }
  return Arr.filter(
    surahs,
    (surah) =>
      `${surah.number}`.startsWith(wanted) ||
      Arr.some([surah.title, surah.arabic, surah.meaning], (name) =>
        fold(name).includes(wanted)
      )
  );
}
