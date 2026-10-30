import type {
  AttemptState,
  SignalKind,
} from "@repo/backend/confect/exams/sittings/schema";
import { Schema } from "effect";

/** How a seat stands in its room's counts: the student is here, away, locked out, or finished (K25). */
export const SeatStanding = Schema.Literals([
  "present",
  "away",
  "locked",
  "finished",
]);
export type SeatStanding = typeof SeatStanding.Type;

/** How many seats of a room stand each way. */
export const SeatCounts = Schema.Record(SeatStanding, Schema.Int);

/** The counts of a room that holds no seat yet, such as one that has not opened. */
export const NO_SEATS: typeof SeatCounts.Type = {
  away: 0,
  finished: 0,
  locked: 0,
  present: 0,
};

/**
 * How an attempt stands, from its state and its latest signal, as the proctor's seat draws it: locked, finished once
 * closing or submitted, away while its latest signal is an exit or a disconnect, and present otherwise.
 */
export const seatStandingOf = (
  state: typeof AttemptState.Type,
  latest: typeof SignalKind.Type | null
): SeatStanding => {
  if (state === "locked") {
    return "locked";
  }
  if (state === "closing" || state === "submitted") {
    return "finished";
  }
  return latest === "exit" || latest === "disconnect" ? "away" : "present";
};
