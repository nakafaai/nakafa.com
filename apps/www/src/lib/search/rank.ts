import { Array as Arr, Option, Order, Schema, String as Str } from "effect";
import { prefixDistance } from "@/lib/search/distance";
import { SearchEntry, type SearchKind } from "@/lib/search/entry";
import {
  foldWord,
  foldWords,
  isProperName,
  splitWords,
} from "@/lib/search/fold";

/** One folded word of a title, and whether it is a proper name that matches only as it is spelled. */
const TitleWord = Schema.Struct({
  proper: Schema.Boolean,
  text: Schema.String,
});
type TitleWord = typeof TitleWord.Type;

/** An entry with its words folded once, when the index loads, so a keystroke folds only the query. */
const PreparedEntry = Schema.Struct({
  entry: SearchEntry,
  joined: Schema.String,
  phrase: Schema.String,
  terms: Schema.Array(TitleWord),
  title: Schema.Array(TitleWord),
  trail: Schema.Array(TitleWord),
});
export type PreparedEntry = typeof PreparedEntry.Type;

/** One result: its entry and how well it answers the query. */
export const SearchHit = Schema.Struct({
  entry: SearchEntry,
  score: Schema.Number,
});
export type SearchHit = typeof SearchHit.Type;

/**
 * How far each kind leads when two results score alike, so a broad place comes
 * before a page inside it: "kimia" opens the subject before a lesson about it.
 */
const KIND_LEAD: Readonly<Record<SearchKind, number>> = {
  article: 0.03,
  category: 0.05,
  country: 0.1,
  curriculum: 0.12,
  exam: 0.11,
  hub: 0.07,
  lesson: 0.04,
  level: 0.09,
  page: 0,
  subject: 0.08,
  surah: 0.06,
  tryout: 0.02,
};

/** How much a match in each part of an entry counts against a match in its title. */
const TERMS_WEIGHT = 0.8;
const TRAIL_WEIGHT = 0.55;

/** The folded words of a text, each marked when it is a proper name. */
function readWords(text: string): readonly TitleWord[] {
  return Arr.map(splitWords(text), (word) => ({
    proper: isProperName(word),
    text: foldWord(word),
  }));
}

/** Folds an entry's words once. A title's words joined also match a query typed without spaces, such as "albaqarah". */
export function prepareEntry(entry: SearchEntry): PreparedEntry {
  const title = readWords(entry.title);
  return {
    entry,
    joined: Arr.join(
      Arr.map(title, ({ text }) => text),
      ""
    ),
    phrase: Arr.join(
      Arr.map(title, ({ text }) => text),
      " "
    ),
    terms: Arr.flatMap(entry.terms ?? [], readWords),
    title,
    trail: Arr.flatMap(entry.trail, readWords),
  };
}

/** How many typing errors a typed word of this length forgives. */
function typoBudget(typed: string) {
  if (typed.length >= 7) {
    return 2;
  }
  return typed.length >= 4 ? 1 : 0;
}

/**
 * How well one typed word matches one word of an entry, from 1 for the word
 * itself down to 0 for no match: the start of the word, a word inside it, then
 * the start of the word with one or two typing errors. A proper name matches
 * only its own spelling or its start.
 */
export function matchWord(typed: string, word: TitleWord) {
  if (word.text === typed) {
    return 1;
  }
  if (Str.startsWith(typed)(word.text)) {
    return 0.75 + (0.2 * typed.length) / word.text.length;
  }
  if (word.proper) {
    return 0;
  }
  if (typed.length >= 4 && Str.includes(typed)(word.text)) {
    return 0.5;
  }
  const budget = typoBudget(typed);
  if (budget === 0) {
    return 0;
  }
  const distance = prefixDistance(typed, word.text, budget);
  return distance > budget ? 0 : 0.7 - 0.15 * distance;
}

/** The best match of a typed word among words. */
function bestMatch(typed: string, words: readonly TitleWord[]) {
  return Arr.reduce(words, 0, (best, word) =>
    Math.max(best, matchWord(typed, word))
  );
}

/**
 * How well a typed word matches a title written without its spaces, such as
 * "albaqarah" for "Al-Baqara": its start, or its start with a typing error
 * unless the title holds a proper name. A word inside it never counts, since it
 * may cross two of the title's words.
 */
function matchJoined(typed: string, prepared: PreparedEntry) {
  if (typed.length < 4) {
    return 0;
  }
  if (Str.startsWith(typed)(prepared.joined)) {
    return 0.9;
  }
  const budget = typoBudget(typed);
  const named = Arr.some(prepared.title, ({ proper }) => proper);
  return named || prefixDistance(typed, prepared.joined, budget) > budget
    ? 0
    : 0.6;
}

/** How well one typed word matches an entry, and whether it matched in the title. */
function matchEntry(typed: string, prepared: PreparedEntry) {
  const inTitle = Math.max(
    bestMatch(typed, prepared.title),
    matchJoined(typed, prepared)
  );
  const elsewhere = Math.max(
    bestMatch(typed, prepared.terms) * TERMS_WEIGHT,
    bestMatch(typed, prepared.trail) * TRAIL_WEIGHT
  );
  return { inTitle: inTitle > 0, score: Math.max(inTitle, elsewhere) };
}

/**
 * How well an entry answers the typed words, or none when one of them matches
 * nothing in it. Every word must match: the title, the other names, or the
 * pages above it. A title that starts with the query, or is the query, leads.
 */
export function scoreEntry(
  typed: readonly string[],
  prepared: PreparedEntry
): Option.Option<number> {
  const matches = Arr.map(typed, (word) => matchEntry(word, prepared));
  if (Arr.some(matches, ({ score }) => score === 0)) {
    return Option.none();
  }
  const mean =
    Arr.reduce(matches, 0, (sum, { score }) => sum + score) / matches.length;
  const phrase = Arr.join(typed, " ");
  const whole = Arr.every(matches, ({ inTitle }) => inTitle) ? 0.25 : 0;
  const start = Str.startsWith(phrase)(prepared.phrase) ? 0.3 : 0;
  const exact = prepared.phrase === phrase ? 0.4 : 0;
  const extra = Math.max(0, prepared.title.length - typed.length) * 0.01;
  return Option.some(
    mean + whole + start + exact + KIND_LEAD[prepared.entry.kind] - extra
  );
}

/** Orders results by score, then by kind, then by the shorter title, then by path, so equal scores never shuffle. */
const HitOrder = Order.combineAll<SearchHit>([
  Order.mapInput(Order.flip(Order.Number), ({ score }) => score),
  Order.mapInput(
    Order.flip(Order.Number),
    ({ entry }) => KIND_LEAD[entry.kind]
  ),
  Order.mapInput(Order.Number, ({ entry }) => entry.title.length),
  Order.mapInput(Order.String, ({ entry }) => entry.path),
]);

/** The entries that answer a query, best first. A query of no words answers nothing. */
export function searchEntries(
  prepared: readonly PreparedEntry[],
  query: string
): readonly SearchHit[] {
  const typed = Arr.dedupe(foldWords(query));
  if (!Arr.isReadonlyArrayNonEmpty(typed)) {
    return [];
  }
  const hits = Arr.getSomes(
    Arr.map(prepared, (entry) =>
      Option.map(scoreEntry(typed, entry), (score) => ({
        entry: entry.entry,
        score,
      }))
    )
  );
  return Arr.sort(hits, HitOrder);
}

/** One run of a title, and whether it is a word the query matched. */
const TitlePart = Schema.Struct({
  hit: Schema.Boolean,
  start: Schema.Number,
  text: Schema.String,
});
export type TitlePart = typeof TitlePart.Type;

/** A word with its accents, or the run between two words. */
const TITLE_RUN = /[\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+/gu;

/**
 * Splits a title into runs and marks each word that a typed word matches, so
 * the row shows why it answers. The title's own spelling is kept, accents and
 * capitals included.
 */
export function markTitle(title: string, query: string): readonly TitlePart[] {
  const typed = Arr.dedupe(foldWords(query));
  const [, parts] = Arr.mapAccum(
    title.match(TITLE_RUN) ?? [],
    0,
    (start, text) =>
      [
        start + text.length,
        {
          hit: Arr.some(readWords(text), (word) =>
            Arr.some(typed, (typedWord) => matchWord(typedWord, word) > 0)
          ),
          start,
          text,
        },
      ] as const
  );
  return parts;
}
