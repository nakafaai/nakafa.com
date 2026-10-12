import { hasWords } from "@repo/backend/confect/nina/memory/match";
import type { NinaMemoryCandidate } from "@repo/backend/confect/nina/memory.spec";
import {
  Array as Arr,
  DateTime,
  Option,
  pipe,
  String as Str,
  Struct,
} from "effect";

type Candidate = typeof NinaMemoryCandidate.Type;

const WHITESPACE = /\s+/gu;

/** Lower case with every run of whitespace as one space: the form a quote is searched in. */
function collapse(text: string) {
  return Str.trim(Str.replaceAll(WHITESPACE, " ")(Str.toLowerCase(text)));
}

/**
 * The last moment of the UTC day that `YYYY-MM-DD` names, or nothing when the
 * text is not a real day. A day that a calendar rolls over, such as February
 * 30, is not real.
 */
export function endOfDay(day: string) {
  return DateTime.make(day).pipe(
    Option.filter((date) => DateTime.formatIsoDateUtc(date) === day),
    Option.map((date) => DateTime.toEpochMillis(DateTime.endOf(date, "day")))
  );
}

/** Whether a situation's last day is today or later. */
function endsInTime(until: string | undefined, now: number) {
  return Option.fromUndefinedOr(until).pipe(
    Option.flatMap(endOfDay),
    Option.exists((end) => end >= now)
  );
}

/** Whether the learner's own words support a candidate, as `collapse` reads them. */
function isSupported(candidate: Candidate, said: string, now: number) {
  const quote = collapse(candidate.quote);
  return (
    quote !== "" &&
    hasWords(candidate.text) &&
    Str.includes(quote)(said) &&
    (candidate.kind !== "situation" || endsInTime(candidate.until, now))
  );
}

/**
 * Keeps the candidates the learner's own words support. A candidate stays only
 * when its quote is in the message, its text says something (it has a letter or
 * a digit), and a situation ends today or later. Only a situation keeps its end
 * date. This reads structure and never meaning: whether a candidate is the
 * learner's own note, or holds something private, is for the decision model to
 * say (`judgment/catalog`).
 */
export function checkCandidates(
  message: string,
  candidates: readonly Candidate[],
  now: number
) {
  const said = collapse(message);
  return pipe(
    candidates,
    Arr.filter((candidate) => isSupported(candidate, said, now)),
    Arr.map((candidate) =>
      candidate.kind === "situation"
        ? candidate
        : Struct.omit(candidate, ["until"])
    )
  );
}
