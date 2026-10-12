import { Array as Arr, HashSet, pipe, String as Str } from "effect";

/** Characters of a word that the index keeps. */
const KEPT_LENGTH = 6;
/** Characters a word needs to say anything. */
const WORD_LENGTH = 3;
/** Digits a number needs to say anything: 12 is a class, 5 is nothing. */
const NUMBER_LENGTH = 2;

const NOT_WORD = /[^\p{L}\p{N}]+/gu;
const NUMBER = /^\p{N}+$/u;

const INDONESIAN =
  "yang dan atau dengan untuk dari pada adalah ini itu saya aku kamu kami akan sudah juga tidak bisa karena";
const ENGLISH =
  "the and for with that this from are was were have has not but you your can will would about into than then they";
const GERMAN =
  "der die das und oder ein eine einen ich mich mir mein ist sind hat nicht mit für von auf auch aber wie wenn";

/** Words of Indonesian, English and German that say nothing about a memory. */
const STOP_WORDS = HashSet.fromIterable(
  Str.split(Arr.join([INDONESIAN, ENGLISH, GERMAN], " "), " ")
);

/** Characters of a run, counted by code point so that an emoji counts once. */
function sizeOf(run: string) {
  return Arr.length(Arr.fromIterable(run));
}

/** Whether a run of letters and digits says something: a number, or a word that is no stop word. */
function isWord(run: string) {
  const size = sizeOf(run);
  return NUMBER.test(run)
    ? size >= NUMBER_LENGTH
    : size >= WORD_LENGTH && !HashSet.has(STOP_WORDS, run);
}

/**
 * The first `KEPT_LENGTH` characters of a run. The crude cut also joins
 * cognates: trigonometri, trigonometry and Trigonometrie all become trigon.
 */
function stem(run: string) {
  return Arr.join(Arr.take(Arr.fromIterable(run), KEPT_LENGTH), "");
}

/**
 * The words a text is found by. Both sides use this one function, the writer
 * that indexes a memory and every search, so they agree on what a word is.
 * The text is normalized (Unicode NFKC, lower case) and split into runs of
 * letters or digits. A run stays when it is a number of two digits or more, or
 * a word of three characters or more that is no stop word. Each stays as its
 * first six characters, once, in the order it first appears.
 */
export function wordsOf(text: string) {
  return pipe(
    text,
    Str.normalize("NFKC"),
    Str.toLowerCase,
    Str.replaceAll(NOT_WORD, " "),
    Str.split(" "),
    Arr.filter(isWord),
    Arr.map(stem),
    Arr.dedupe
  );
}
