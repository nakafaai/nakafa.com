import { HashMap, Number as Num, Option, Schema } from "effect";
import type { DashboardAttempt } from "@/components/exams/sitting/change";

/** The filters of the dashboard, in the order the filter row shows them. */
export const SittingFilter = Schema.Literals([
  "all",
  "needsAttention",
  "finished",
]);
export type SittingFilter = typeof SittingFilter.Type;

/**
 * The colour of a seat's frame. A locked seat is red, a submitted seat is green, and an
 * away seat is yellow. A seat with none of these keeps the plain frame.
 */
export type SeatFrame = "away" | "locked" | "plain" | "submitted";

/**
 * The frame of a seat. A locked attempt shows red and a submitted one shows green, even
 * when the student left before that, so the frame follows the state first and the
 * absence second.
 */
export function seatFrame(attempt: DashboardAttempt): SeatFrame {
  if (attempt.state === "locked") {
    return "locked";
  }
  if (attempt.state === "submitted") {
    return "submitted";
  }
  if (attempt.away) {
    return "away";
  }
  return "plain";
}

/** What the time on a seat's second line means, by the attempt's state, so no state rests on the frame's colour. */
const SEAT_TIME_KEYS = {
  closing: "seat-last-activity",
  inProgress: "seat-last-activity",
  locked: "seat-locked",
  submitted: "seat-finished",
} as const satisfies Record<DashboardAttempt["state"], string>;

/** The copy key of the sentence that a seat tells its last activity in. */
export const seatTimeKey = (attempt: DashboardAttempt) =>
  SEAT_TIME_KEYS[attempt.state];

/**
 * The time of a seat's last activity: the newer of the page's time (the start or the latest signal)
 * and the latest answer, which the seat reads on its own. Until that answer arrives, the page's time shows.
 */
export function lastActivityOf(
  attempt: DashboardAttempt,
  answeredAt: number | null
): number {
  return answeredAt === null
    ? attempt.lastActiveAt
    : Num.max(attempt.lastActiveAt, answeredAt);
}

/**
 * The attempt as its seat shows it, once presence says the student went silent while the attempt runs. The student
 * reads as disconnected since then, so the seat's frame, its clock and the filter all follow it. A student who left
 * the exam stays away, since the exit says more, and a locked or finished seat keeps its state.
 */
export function seenOffline(
  attempt: DashboardAttempt,
  offline: HashMap.HashMap<DashboardAttempt["id"], number>
): DashboardAttempt {
  if (attempt.state !== "inProgress" || attempt.away) {
    return attempt;
  }
  return Option.match(HashMap.get(offline, attempt.id), {
    onNone: () => attempt,
    onSome: (since) => ({
      ...attempt,
      away: true,
      latestSignal: { at: since, kind: "disconnect" },
    }),
  });
}

/** The seconds of one minute, which a long time away is told in. */
export const SECONDS_IN_MINUTE = 60;

/**
 * The moment a seat's student went away, while the seat shows the student away: the time of the exit or the
 * disconnect that no return followed. None for a student who is here, locked, or finished.
 */
export function awaySince(attempt: DashboardAttempt): Option.Option<number> {
  if (seatFrame(attempt) !== "away" || attempt.latestSignal === null) {
    return Option.none();
  }
  return Option.some(attempt.latestSignal.at);
}

/**
 * The time from `since` to `now` in whole minutes and seconds, never below zero, so a device clock a little behind
 * the server's shows no negative time.
 */
export function awayTime(since: number, now: number) {
  const total = Num.max(0, Math.floor((now - since) / 1000));
  return {
    minutes: Math.floor(total / SECONDS_IN_MINUTE),
    seconds: total % SECONDS_IN_MINUTE,
  };
}

/** Whether the student's latest signal is a disconnect, which draws the seat's frame dashed. */
export function isDisconnected(attempt: DashboardAttempt) {
  return (
    attempt.latestSignal !== null && attempt.latestSignal.kind === "disconnect"
  );
}

/**
 * Whether an attempt belongs under a filter. Needs attention means locked, or away,
 * and a submitted attempt never needs attention. Finished means submitted.
 */
export function matchesFilter(
  filter: SittingFilter,
  attempt: DashboardAttempt
): boolean {
  if (filter === "all") {
    return true;
  }
  if (filter === "finished") {
    return attempt.state === "submitted";
  }
  if (attempt.state === "submitted") {
    return false;
  }
  return attempt.state === "locked" || attempt.away;
}
