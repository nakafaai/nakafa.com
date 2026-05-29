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

const attemptEndReasonsByStatus = {
  completed: "submitted",
  expired: "time-expired",
} satisfies Record<FinalizedAttemptStatus, AttemptEndReason>;

/** Returns the persisted end reason for one finalized attempt status. */
export function getAttemptEndReasonFromStatus(
  status: FinalizedAttemptStatus
): AttemptEndReason {
  return attemptEndReasonsByStatus[status];
}
