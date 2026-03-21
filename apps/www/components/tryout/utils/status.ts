import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type TryoutAttemptStatus = NonNullable<
  FunctionReturnType<typeof api.tryouts.queries.attempts.getUserTryoutAttempt>
>["attempt"]["status"];
type ExerciseAttemptStatus = NonNullable<
  NonNullable<
    FunctionReturnType<
      typeof api.tryouts.queries.attempts.getUserTryoutPartAttempt
    >
  >["partAttempt"]
>["setAttempt"]["status"];

/**
 * Derives the student-visible tryout status from the persisted status plus the
 * known expiry boundary.
 */
export function getEffectiveTryoutStatus({
  expiresAtMs,
  nowMs,
  status,
}: {
  expiresAtMs: number;
  nowMs: number;
  status: TryoutAttemptStatus;
}) {
  if (status !== "in-progress") {
    return status;
  }

  if (nowMs < expiresAtMs) {
    return status;
  }

  return "expired";
}

/**
 * Derives the current part attempt status from the exercise timer and the
 * parent tryout expiry boundary.
 */
export function getEffectivePartAttemptStatus({
  expiresAtMs,
  nowMs,
  setAttempt,
}: {
  expiresAtMs?: number;
  nowMs: number;
  setAttempt: {
    startedAt?: number;
    status: ExerciseAttemptStatus;
    timeLimit?: number;
  };
}) {
  if (setAttempt.status !== "in-progress") {
    return setAttempt.status;
  }

  if (
    setAttempt.startedAt === undefined ||
    setAttempt.timeLimit === undefined
  ) {
    return setAttempt.status;
  }

  if (expiresAtMs === undefined) {
    return setAttempt.status;
  }

  const setExpiresAtMs = setAttempt.startedAt + setAttempt.timeLimit * 1000;
  const effectiveExpiresAtMs = Math.min(expiresAtMs, setExpiresAtMs);

  if (nowMs < effectiveExpiresAtMs) {
    return setAttempt.status;
  }

  return "expired";
}
