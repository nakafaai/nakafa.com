import { Array as Arr, Order, pipe, String as Str } from "effect";

/** Characters of a word that the index keeps. */
const KEPT_LENGTH = 6;

/**
 * The most a word is worth to a memory that holds it: when no other memory of
 * the learner holds the word. A word is never worth more.
 */
const WORD_WORTH = 1;

/**
 * The words of a text, by the word boundaries of Unicode (UAX 29), which the
 * platform knows for every script: its dictionaries split Japanese, Chinese and
 * Thai, which put no space between words. The locale is named so that the
 * words never depend on the locale a runtime defaults to.
 */
const segmenter = new Intl.Segmenter("en", { granularity: "word" });

/** Characters of a run, counted by code point so that an emoji counts once. */
function sizeOf(run: string) {
  return Arr.length(Arr.fromIterable(run));
}

/**
 * The first `KEPT_LENGTH` characters of a word. The crude cut also joins
 * cognates: trigonometri, trigonometry and Trigonometrie all become trigon.
 */
function stem(word: string) {
  return Arr.join(Arr.take(Arr.fromIterable(word), KEPT_LENGTH), "");
}

/**
 * The whole words of a text, each once, in the order it first appears. The text
 * is normalized (Unicode NFKC, lower case) and split at the word boundaries of
 * the platform; a segment that is a word or a number stays, and punctuation,
 * spaces and emoji go.
 */
function wholeWordsOf(text: string) {
  return pipe(
    text,
    Str.normalize("NFKC"),
    Str.toLowerCase,
    (normalized) => Arr.fromIterable(segmenter.segment(normalized)),
    Arr.filter((part) => part.isWordLike === true),
    Arr.map((part) => part.segment),
    Arr.dedupe
  );
}

/**
 * The words a text is found by. Both sides use this one function, the writer
 * that indexes a memory and every search, so they agree on what a word is: the
 * whole words of the text (`wholeWordsOf`), each cut to its first six
 * characters, once, in the order it first appears. No list of words and no
 * minimum length decides what a word is, because both would hold for some
 * languages and not for others: how much a word says about a memory is the
 * search's to weigh (`wordWorth`).
 *
 * What a word is changes when the platform's word boundaries do, and a stored
 * key was made from the old word, so a change here is a new version of the
 * index (`WORD_INDEX_VERSION` in `memory/keys`).
 */
export function wordsOf(text: string) {
  return pipe(wholeWordsOf(text), Arr.map(stem), Arr.dedupe);
}

/**
 * The words a search looks up first: those of the `limit` longest whole words
 * of a text, the longest first, and words of one length in the order they came
 * in. A search looks up only so many keys. A word that is frequent in a
 * language is short in it (articles, particles, pronouns), so the long words
 * say the most about a text, in every language. The whole word is measured,
 * not the six characters the index keeps of it, because every long word is six
 * characters once cut and none would be longer than another.
 */
export function longestWords(text: string, limit: number) {
  return pipe(
    wholeWordsOf(text),
    Arr.sort(Order.flip(Order.mapInput(Order.Number, sizeOf))),
    Arr.map(stem),
    Arr.dedupe,
    Arr.take(limit)
  );
}

/**
 * What a word is worth to a memory that holds it, by how many of the learner's
 * memories the search read for the word's key: `WORD_WORTH / linked`. A word
 * that one memory holds is worth 1, a word that two hold 1/2, and a word that
 * most of the learner's memories hold, such as "the" or "yang", is worth little
 * however many words it sits among. The search reads at most 24 memories for a
 * key, so a word that 24 or more memories hold is worth 1/24, which is less
 * than any word that fewer hold. `linked` is at least 1: it is the size of a
 * read that found the memory.
 */
export function wordWorth(linked: number) {
  return WORD_WORTH / linked;
}
