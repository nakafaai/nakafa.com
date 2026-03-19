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
  nextPartKey: string | undefined;
  status: TryoutAttemptStatus;
}

function getTryoutPartStatus({
  isRuntimePending,
  partAttempt,
  partKey,
  tryout,
}: {
  isRuntimePending: boolean;
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

  if (tryout.status !== "in-progress") {
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
  partKey,
  runtime,
}: {
  isRuntimePending: boolean;
  partKey: string;
  runtime: TryoutPartRuntime | undefined;
}) {
  const partAttempt = runtime?.partAttempt ?? null;
  const tryout = runtime
    ? {
        completedPartIndices: runtime.completedPartIndices,
        nextPartKey: runtime.nextPartKey,
        status: runtime.tryoutAttempt.status,
      }
    : null;
  const status = getTryoutPartStatus({
    isRuntimePending,
    partAttempt,
    partKey,
    tryout,
  });
  const partEndReason = partAttempt?.setAttempt.endReason ?? null;

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
  partKey,
}: {
  attemptData: TryoutAttemptData | undefined;
  partKey: string;
}) {
  const partAttempt =
    attemptData?.partAttempts.find((attempt) => attempt.partKey === partKey) ??
    null;
  const tryout = attemptData
    ? {
        completedPartIndices: attemptData.completedPartIndices,
        nextPartKey: attemptData.nextPartKey,
        status: attemptData.attempt.status,
      }
    : null;
  const status = getTryoutPartStatus({
    isRuntimePending: false,
    partAttempt,
    partKey,
    tryout,
  });

  return {
    isCurrent:
      (status === "in-progress" || status === "ready") &&
      attemptData?.nextPartKey === partKey,
    status,
  };
}

export type TryoutPartPageState = ReturnType<typeof deriveTryoutPartPageState>;
