import { String as Str } from "effect";

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

/**
 * Whether a text has a word once case, punctuation and spacing are ignored. A
 * letter or a digit makes a word. A memory that is only a title has none.
 */
export function hasWords(text: string) {
  return Str.isNonEmpty(normalizeText(text));
}

/**
 * Whether two texts are the same once case, punctuation and spacing are
 * ignored. This is an identity check on what is stored: whether two sentences
 * mean the same is for the capture model to say, never for a comparison of
 * their words.
 */
export function sameWords(first: string, second: string) {
  return normalizeText(first) === normalizeText(second);
}
