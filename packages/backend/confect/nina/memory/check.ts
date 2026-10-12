import { hasWords } from "@repo/backend/confect/nina/memory/match";
import {
  NinaMemoryCandidate,
  type NinaMemoryClaim,
} from "@repo/backend/confect/nina/memory.spec";
import { Array as Arr, DateTime, Option, Schema, String as Str } from "effect";

type Claim = typeof NinaMemoryClaim.Type;
type Candidate = typeof NinaMemoryCandidate.Type;

const toCandidate = Schema.decodeUnknownOption(NinaMemoryCandidate);

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
function endsInTime(until: string, now: number) {
  return Option.exists(endOfDay(until), (end) => end >= now);
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
 * Makes the claims of the capture model into candidates, and keeps those the
 * learner's own words support. A claim is a candidate when it fits one: a
 * situation names its end date, and a claim of any other kind has none, so it
 * loses one it was given (`NinaMemoryCandidate`). A candidate stays only when
 * its quote is in the message, its text says something (it has a letter or a
 * digit), and a situation ends today or later. This reads structure and never
 * meaning: whether a candidate is the learner's own note, or holds something
 * private, is for the decision model to say (`judgment/catalog`).
 */
export function checkCandidates(
  message: string,
  claims: readonly Claim[],
  now: number
) {
  const said = collapse(message);
  return Arr.flatMap(claims, (claim) =>
    Arr.fromOption(
      Option.filter(toCandidate(claim), (candidate) =>
        isSupported(candidate, said, now)
      )
    )
  );
}
