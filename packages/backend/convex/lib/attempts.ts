import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

export const attemptEndReasonValidator = literals("submitted", "time-expired");

export type AttemptEndReason = Infer<typeof attemptEndReasonValidator>;

export type FinalizedAttemptStatus = "completed" | "expired";

export function getAttemptEndReasonFromStatus(
  status: FinalizedAttemptStatus
): AttemptEndReason {
  switch (status) {
    case "completed":
      return "submitted";
    case "expired":
      return "time-expired";
    default: {
      const exhaustiveStatus: never = status;

      return exhaustiveStatus;
    }
  }
}
