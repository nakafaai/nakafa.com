import { Schema } from "effect";

/** User-facing reason recorded when an attempt ends. */
export const attemptEndReasonSchema = Schema.Literal(
  "submitted",
  "time-expired"
);

export type AttemptEndReason = Schema.Schema.Type<
  typeof attemptEndReasonSchema
>;

/** Finalized attempt statuses that map to persisted end reasons. */
export const finalizedAttemptStatusSchema = Schema.Literal(
  "completed",
  "expired"
);

export type FinalizedAttemptStatus = Schema.Schema.Type<
  typeof finalizedAttemptStatusSchema
>;

/** Maps finalized runtime status to its persisted end reason. */
export function getAttemptEndReasonFromStatus(
  status: FinalizedAttemptStatus
): AttemptEndReason {
  if (status === "completed") {
    return "submitted";
  }

  return "time-expired";
}
