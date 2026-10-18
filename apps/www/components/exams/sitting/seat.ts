import { Schema } from "effect";
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
