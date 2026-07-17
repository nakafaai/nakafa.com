import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Reason persisted when an attempt leaves an in-progress state. */
export const attemptEndReasonValidator = literals("submitted", "time-expired");
export type AttemptEndReason = Infer<typeof attemptEndReasonValidator>;

/** Final attempt statuses that can be mapped to a persisted end reason. */
export const finalizedAttemptStatusValidator = literals("completed", "expired");
export type FinalizedAttemptStatus = Infer<
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
