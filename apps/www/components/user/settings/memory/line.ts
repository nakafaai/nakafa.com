import { Array as Arr, Option } from "effect";

/**
 * Joins what a memory's facts line says: when a situation ends, who wrote the
 * memory, and when it was last confirmed. The end comes first because a row
 * keeps one line and cuts it at its end, and the end is the one fact a learner
 * must not lose, where the confirmed time can lose its last words.
 */
export function factsLine({
  confirmed,
  ends,
  origin,
}: {
  confirmed: string;
  ends: Option.Option<string>;
  origin: string;
}) {
  return Arr.join(
    Arr.appendAll(Option.toArray(ends), [origin, confirmed]),
    " · "
  );
}
