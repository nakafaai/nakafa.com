import { Array as Arr, Option } from "effect";

/**
 * The 1-based number of a question in the frozen order, or 0 when it is not in
 * the order. A section numbers its questions from 1 to their count in that
 * order, so the position of a question is its number.
 */
export function readPosition(keys: readonly string[], current: string | null) {
  return Option.match(
    Arr.findFirstIndex(keys, (key) => key === current),
    { onNone: () => 0, onSome: (index) => index + 1 }
  );
}

/** The key of the question `delta` places before or after `current`, when there is one. */
export function readNeighbor(
  keys: readonly string[],
  current: string | null,
  delta: -1 | 1
) {
  return Option.flatMap(
    Arr.findFirstIndex(keys, (key) => key === current),
    (index) => Arr.get(keys, index + delta)
  );
}
