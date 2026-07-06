type TimedTryoutStatus = "completed" | "expired" | "in-progress";

interface TryoutRuntimeStatusInput {
  expiresAt: number;
  now: number;
  status: TimedTryoutStatus;
}

/** Returns whether a Convex try-out row is effectively active right now. */
export function isTryoutActive({
  expiresAt,
  now,
  status,
}: TryoutRuntimeStatusInput) {
  return status === "in-progress" && now < expiresAt;
}
