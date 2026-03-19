import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";

type TryoutAttemptData = FunctionReturnType<
  typeof api.tryouts.queries.attempts.getUserTryoutAttempt
>;

type TryoutPartRuntime = FunctionReturnType<
  typeof api.tryouts.queries.attempts.getUserTryoutPartAttempt
>;

interface TryoutPartAttempt {
  partIndex: number;
  setAttempt: NonNullable<TryoutAttemptData>["partAttempts"][number]["setAttempt"];
}
type TryoutAttemptStatus = NonNullable<TryoutAttemptData>["attempt"]["status"];

export type TryoutPartUiStatus =
  | "completed"
  | "ended"
  | "in-progress"
  | "loading"
  | "locked"
  | "needs-tryout"
  | "ready";

interface TryoutProgress {
  completedPartIndices: number[];
  expiresAtMs: number;
  nextPartKey: string | undefined;
  status: TryoutAttemptStatus;
}

function hasExpiredPartAttempt({
  nowMs,
  partAttempt,
}: {
  nowMs: number;
  partAttempt: TryoutPartAttempt | null;
}) {
  if (!partAttempt) {
    return false;
  }

  if (partAttempt.setAttempt.status !== "in-progress") {
    return false;
  }

  const expiresAtMs =
    partAttempt.setAttempt.startedAt + partAttempt.setAttempt.timeLimit * 1000;

  return nowMs >= expiresAtMs;
}

function isActiveTryout({
  expiresAtMs,
  nowMs,
  status,
}: {
  expiresAtMs: number;
  nowMs: number;
  status: TryoutAttemptStatus;
}) {
  return status === "in-progress" && expiresAtMs > nowMs;
}

function getTryoutPartStatus({
  isRuntimePending,
  nowMs,
  partAttempt,
  partKey,
  tryout,
}: {
  isRuntimePending: boolean;
  nowMs: number;
  partAttempt: TryoutPartAttempt | null;
  partKey: string;
  tryout: TryoutProgress | null;
}): TryoutPartUiStatus {
  if (isRuntimePending) {
    return "loading";
  }

  if (!tryout) {
    return "needs-tryout";
  }

  if (
    partAttempt &&
    tryout.completedPartIndices.includes(partAttempt.partIndex)
  ) {
    return "completed";
  }

  if (hasExpiredPartAttempt({ nowMs, partAttempt })) {
    return "completed";
  }

  const tryoutIsActive = isActiveTryout({
    expiresAtMs: tryout.expiresAtMs,
    nowMs,
    status: tryout.status,
  });

  if (!tryoutIsActive) {
    return "ended";
  }

  if (partAttempt?.setAttempt.status === "in-progress") {
    return "in-progress";
  }

  if (!partAttempt && tryout.nextPartKey && tryout.nextPartKey !== partKey) {
    return "locked";
  }

  return "ready";
}

export function deriveTryoutPartPageState({
  isRuntimePending,
  nowMs,
  partKey,
  runtime,
}: {
  isRuntimePending: boolean;
  nowMs: number;
  partKey: string;
  runtime: TryoutPartRuntime | undefined;
}) {
  const partAttempt = runtime?.partAttempt ?? null;
  const tryout = runtime
    ? {
        completedPartIndices: runtime.completedPartIndices,
        expiresAtMs: runtime.expiresAtMs,
        nextPartKey: runtime.nextPartKey,
        status: runtime.tryoutAttempt.status,
      }
    : null;
  const status = getTryoutPartStatus({
    isRuntimePending,
    nowMs,
    partAttempt,
    partKey,
    tryout,
  });
  const partEndReason = hasExpiredPartAttempt({ nowMs, partAttempt })
    ? "time-expired"
    : (partAttempt?.setAttempt.endReason ?? null);

  return {
    answers: partAttempt?.answers ?? [],
    attempt: partAttempt?.setAttempt ?? null,
    canStartPart: status === "ready" && runtime?.nextPartKey === partKey,
    partEndReason,
    status,
  };
}

export function deriveTryoutSetPartState({
  attemptData,
  nowMs,
  partKey,
}: {
  attemptData: TryoutAttemptData | undefined;
  nowMs: number;
  partKey: string;
}) {
  const partAttempt =
    attemptData?.partAttempts.find((attempt) => attempt.partKey === partKey) ??
    null;
  const tryout = attemptData
    ? {
        completedPartIndices: attemptData.completedPartIndices,
        expiresAtMs: attemptData.expiresAtMs,
        nextPartKey: attemptData.nextPartKey,
        status: attemptData.attempt.status,
      }
    : null;
  const status = getTryoutPartStatus({
    isRuntimePending: false,
    nowMs,
    partAttempt,
    partKey,
    tryout,
  });

  return {
    isCurrent: status !== "completed" && attemptData?.nextPartKey === partKey,
    status,
  };
}

export type TryoutPartPageState = ReturnType<typeof deriveTryoutPartPageState>;
