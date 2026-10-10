import type { Opened } from "@repo/backend/confect/nina/memory/seal";
import type { NinaMemoryCandidate } from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, HashSet, Option, String as Str } from "effect";

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

/** What a candidate is matched against: the memory's id, its kind when it has one, and its opened words. */
type Stored = Pick<Opened, "_id" | "kind" | "text">;

/**
 * Whether a memory can be of a candidate's kind: it is of that kind, or it has
 * none. Only a memory the learner wrote has none, and a chat that says it again
 * gives it one.
 */
function takesKind(memory: Stored, kind: typeof NinaMemoryCandidate.Type.kind) {
  return memory.kind === undefined || memory.kind === kind;
}

/**
 * The memory a candidate confirms: the known memory it names, or else the first
 * memory that says the same. A memory of another kind does not count in either
 * case, so a situation's date never lands on a goal. A memory without a kind
 * counts for every kind.
 */
export function findTarget<Memory extends Stored>(
  memories: readonly Memory[],
  candidate: typeof NinaMemoryCandidate.Type
) {
  return Arr.findFirst(
    memories,
    (memory) =>
      memory._id === candidate.known && takesKind(memory, candidate.kind)
  ).pipe(
    Option.orElse(() =>
      Arr.findFirst(
        memories,
        (memory) =>
          takesKind(memory, candidate.kind) &&
          saysSame(memory.text, candidate.text)
      )
    )
  );
}
