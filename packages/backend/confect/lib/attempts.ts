import { Schema } from "effect";
/** Reason persisted when an attempt leaves an in-progress state. */
export const attemptEndReasonValidator = Schema.Literals([
  "submitted",
  "time-expired",
]);
export type AttemptEndReason = Schema.Schema.Type<
  typeof attemptEndReasonValidator
>;

/** Final attempt statuses that can be mapped to a persisted end reason. */
export const finalizedAttemptStatusValidator = Schema.Literals([
  "completed",
  "expired",
]);
export type FinalizedAttemptStatus = Schema.Schema.Type<
  typeof finalizedAttemptStatusValidator
>;
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
