import { Array as Arr, String as Str } from "effect";

/** Characters a message needs before it can state anything lasting about the learner. */
const MIN_LENGTH = 12;

/**
 * Whole words with which a learner speaks about themself, by language. The
 * English "i" also stands for "I'm", "I've" and "I am", because an apostrophe
 * or a space ends a word.
 */
const FIRST_PERSON = [
  // Indonesian
  "aku",
  "saya",
  "sy",
  "gue",
  "gua",
  "gw",
  "ku",
  // English
  "i",
  "my",
  "me",
  "myself",
  // German
  "ich",
  "mein",
  "meine",
  "meinen",
  "meinem",
  "meiner",
  "meines",
  "mir",
  "mich",
];

/** Verbs that take the Indonesian prefix ku-, as in "kuingin" for "I want". */
const KU_VERBS = [
  "ingin",
  "mau",
  "pikir",
  "rasa",
  "kira",
  "tahu",
  "belajar",
  "baca",
  "coba",
  "lihat",
  "suka",
  "butuh",
  "perlu",
  "harap",
];

/** Words that end in -ku without meaning "my", such as a book or a tribe. */
const NOT_POSSESSIVE = [
  "bangku",
  "baku",
  "beku",
  "buku",
  "haiku",
  "kaku",
  "kuku",
  "laku",
  "mengaku",
  "paku",
  "pelaku",
  "saku",
  "sudoku",
  "suku",
];

/** A letter or digit next to a word means the word is part of a longer one. */
const BEFORE = String.raw`(?<![\p{L}\p{N}_])`;
const AFTER = String.raw`(?![\p{L}\p{N}_])`;

/**
 * The first-person forms: the words above, the prefix ku- before a verb, and
 * the suffix -ku after a noun, as in "kelasku" for "my class".
 */
const MARKER = new RegExp(
  String.raw`${BEFORE}(?:${Arr.join(FIRST_PERSON, "|")}|ku(?:${Arr.join(KU_VERBS, "|")})|(?!(?:${Arr.join(NOT_POSSESSIVE, "|")})${AFTER})\p{L}{2,}ku)${AFTER}`,
  "iu"
);

/**
 * Whether a learner's message can hold a memory: long enough, and with a
 * first-person word. A plain question never passes, so it never costs a model
 * call.
 */
export function passesGate(message: string) {
  const text = Str.trim(message);
  return Str.length(text) >= MIN_LENGTH && MARKER.test(text);
}
