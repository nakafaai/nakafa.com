import { HashSet, String as Str } from "effect";

/** The share of words two texts must have in common to say the same thing. */
const SAME_OVERLAP = 0.8;

const NOT_WORD = /[^\p{L}\p{N}\s]/gu;
const WHITESPACE = /\s+/gu;

/** Lower case, punctuation as a space, whitespace collapsed: the form two texts are compared in. */
function normalizeText(text: string) {
  return Str.trim(
    Str.replaceAll(
      WHITESPACE,
      " "
    )(Str.replaceAll(NOT_WORD, " ")(Str.toLowerCase(text)))
  );
}

/** The words of a normalized text, each counted once. */
function wordsOf(text: string) {
  return HashSet.fromIterable(Str.split(text, " "));
}

/** Whether two texts hold the same words once case, punctuation and spacing are ignored. */
export function sameWords(first: string, second: string) {
  return normalizeText(first) === normalizeText(second);
}

/**
 * Whether two texts say the same thing: the same words, or sharing at least 80
 * percent of their words (the words in both, over the words in either).
 */
export function saysSame(first: string, second: string) {
  if (sameWords(first, second)) {
    return true;
  }
  const leftWords = wordsOf(normalizeText(first));
  const rightWords = wordsOf(normalizeText(second));
  const shared = HashSet.size(HashSet.intersection(leftWords, rightWords));
  const either = HashSet.size(HashSet.union(leftWords, rightWords));
  return shared / either >= SAME_OVERLAP;
}
