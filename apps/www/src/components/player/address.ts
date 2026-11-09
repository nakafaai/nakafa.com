import { Array as Arr, Option, Schema } from "effect";

/** Search parameter that names the current question by its number, so a reload opens the same question. */
export const PLAYER_QUESTION_PARAM = "question";

/** A question number as an address writes it: a whole number from 1. */
const QuestionNumber = Schema.FiniteFromString.pipe(
  Schema.decodeTo(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)))
);

const decodeQuestionNumber = Schema.decodeUnknownOption(QuestionNumber);

/**
 * The key of the question that an address's search names among `keys`, which a paper numbers from 1 in
 * their order. A number past them, or anything that is no number, names none.
 */
export function readAddressedKey(search: string, keys: readonly string[]) {
  return Option.flatMap(
    Option.flatMap(
      Option.fromNullishOr(
        new URLSearchParams(search).get(PLAYER_QUESTION_PARAM)
      ),
      decodeQuestionNumber
    ),
    (number) => Arr.get(keys, number - 1)
  );
}

/**
 * What the address holds for the current question: its number, or nothing for the first, which a bare
 * address opens already.
 */
export function addressOf(keys: readonly string[], current: string | null) {
  return Option.flatMap(
    Arr.findFirstIndex(keys, (key) => key === current),
    (index) => (index === 0 ? Option.none() : Option.some(String(index + 1)))
  );
}

/**
 * Writes one search parameter of the address in place, or takes it away when `value` is none. The entry
 * keeps its history state, so the router's scroll memory and the way back stay as they were, and the
 * router reads nothing new: the address only remembers.
 */
export function replaceSearchParam(name: string, value: Option.Option<string>) {
  const url = new URL(window.location.href);
  Option.match(value, {
    onNone: () => url.searchParams.delete(name),
    onSome: (text) => url.searchParams.set(name, text),
  });
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, "", url);
  }
}
