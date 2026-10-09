import { Schema } from "effect";
/** Reason persisted when an attempt leaves an in-progress state. */
export const attemptEndReasonValidator = Schema.Literals([
  "submitted",
  "time-expired",
]);
export type AttemptEndReason = typeof attemptEndReasonValidator.Type;

/** Final attempt statuses that can be mapped to a persisted end reason. */
const finalizedAttemptStatusValidator = Schema.Literals([
  "completed",
  "expired",
]);
type FinalizedAttemptStatus = typeof finalizedAttemptStatusValidator.Type;
const finalizedAttemptStatusesByEndReason = {
  submitted: "completed",
  "time-expired": "expired",
} satisfies Record<AttemptEndReason, FinalizedAttemptStatus>;

/** Returns the final attempt status for one persisted end reason. */
export function getAttemptStatusFromEndReason(
  endReason: AttemptEndReason
): FinalizedAttemptStatus {
  return finalizedAttemptStatusesByEndReason[endReason];
}
