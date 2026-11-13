import { Array as Arr, String as Str } from "effect";

/** Letters that no Unicode decomposition takes apart, spelled as a reader types them. */
const LIGATURES: ReadonlyArray<readonly [RegExp, string]> = [
  [/ß/gu, "ss"],
  [/æ/gu, "ae"],
  [/œ/gu, "oe"],
  [/ø/gu, "o"],
  [/ı/gu, "i"],
  [/ł/gu, "l"],
];

/**
 * German readers type an umlaut as its two letters, so "Faecher" and "Fächer"
 * fold to one word. Both sides of a match fold the same way, so a word that
 * merely holds "ae", such as "aerobic", still matches itself.
 */
const UMLAUT_SPELLINGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/ae/gu, "a"],
  [/oe/gu, "o"],
  [/ue/gu, "u"],
];

/** Marks that a decomposition leaves behind its letter: accents, umlauts, the Arabic transliteration's macrons. */
const COMBINING_MARKS = /\p{M}/gu;

/** What splits words: anything that is neither a letter nor a digit, and the seam between letters and digits. */
const WORD_BREAK = /[^\p{L}\p{N}]+|(?<=\p{L})(?=\p{N})|(?<=\p{N})(?=\p{L})/u;

/** Folds one word as every locale's reader may type it: no case, no accents, umlauts as their plain vowel. */
export function foldWord(word: string) {
  const plain = Str.toLowerCase(word.normalize("NFKD")).replace(
    COMBINING_MARKS,
    ""
  );
  const spelled = Arr.reduce(LIGATURES, plain, (text, [letter, spelling]) =>
    text.replace(letter, spelling)
  );
  return Arr.reduce(UMLAUT_SPELLINGS, spelled, (text, [pair, vowel]) =>
    text.replace(pair, vowel)
  );
}

/** Splits a text into its folded words, in their order, without empty words. */
export function foldWords(text: string) {
  return Arr.filter(Arr.map(splitWords(text), foldWord), Str.isNonEmpty);
}

/** Splits a text into its words as written, after its accents leave their letters, so "Fächer" stays one word. */
export function splitWords(text: string) {
  return Arr.filter(
    text.normalize("NFKD").replace(COMBINING_MARKS, "").split(WORD_BREAK),
    Str.isNonEmpty
  );
}

/** A word of capitals and digits, two characters or more. */
const PROPER_NAME = /^\p{Lu}[\p{Lu}\p{N}]+$/u;

/**
 * Whether a word of a title is a proper noun that only matches as it is spelled:
 * an exam or a curriculum written in capitals, such as SNBT, TKA or KSSM. A typo
 * of one letter turns such a name into another name, so it is never corrected.
 */
export function isProperName(word: string) {
  return PROPER_NAME.test(word);
}
