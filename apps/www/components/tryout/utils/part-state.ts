import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import {
  getEffectivePartAttemptStatus,
  getEffectiveTryoutStatus,
} from "@/components/tryout/utils/status";

type TryoutAttemptData = FunctionReturnType<
  typeof api.tryouts.queries.attempts.getUserTryoutAttempt
>;

type TryoutPartRuntime = FunctionReturnType<
  typeof api.tryouts.queries.attempts.getUserTryoutPartAttempt
>;

type TryoutPartAttempt = Pick<
  NonNullable<TryoutAttemptData>["partAttempts"][number],
  "partIndex" | "setAttempt"
>;
type TryoutAttemptStatus = NonNullable<TryoutAttemptData>["attempt"]["status"];

export type TryoutPartUiStatus =
  | "completed"
  | "ended"
  | "in-progress"
  | "loading"
  | "needs-tryout"
  | "ready";

type TryoutProgress = Pick<
  NonNullable<TryoutAttemptData>["attempt"],
  "completedPartIndices" | "status"
>;

function getTryoutPartPageStatus({
  isRuntimePending,
  partAttempt,
  tryout,
}: {
  isRuntimePending: boolean;
  partAttempt: TryoutPartAttempt | null;
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

  if (partAttempt) {
    return "ended";
  }

  return "ready";
}

function getTryoutSetPartStatus({
  expiresAtMs,
  isRuntimePending,
  nowMs,
  partAttempt,
  tryout,
}: {
  expiresAtMs: number | undefined;
  isRuntimePending: boolean;
  nowMs: number;
  partAttempt: TryoutPartAttempt | null;
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

  if (
    partAttempt &&
    getEffectivePartAttemptStatus({
      expiresAtMs,
      nowMs,
      setAttempt: partAttempt.setAttempt,
    }) !== "in-progress"
  ) {
    return "ended";
  }

  if (partAttempt?.setAttempt.status === "in-progress") {
    return "in-progress";
  }

  return "ready";
}

export function deriveTryoutPartPageState({
  nowMs,
  isRuntimePending,
  runtime,
}: {
  nowMs: number;
  isRuntimePending: boolean;
  runtime: TryoutPartRuntime | undefined;
}) {
  const partAttempt = runtime?.partAttempt ?? null;

  if (!runtime) {
    return {
      answers: [],
      attempt: null,
      canStartPart: false,
      partEndReason: null,
      status: getTryoutPartPageStatus({
        isRuntimePending,
        partAttempt,
        tryout: null,
      }),
    };
  }

  const tryout = {
    completedPartIndices: runtime.tryoutAttempt.completedPartIndices,
    status: getEffectiveTryoutStatus({
      expiresAtMs: runtime.expiresAtMs,
      nowMs,
      status: runtime.tryoutAttempt.status,
    }),
  };
  const status = getTryoutPartPageStatus({
    isRuntimePending,
    partAttempt,
    tryout,
  });
  const partEndReason = partAttempt?.setAttempt.endReason ?? null;

  return {
    answers: partAttempt?.answers ?? [],
    attempt: partAttempt?.setAttempt ?? null,
    canStartPart: status === "ready",
    partEndReason,
    status,
  };
}

export function deriveTryoutSetPartState({
  attemptData,
  effectiveStatus,
  nowMs,
  partKey,
  resumePartKey,
}: {
  attemptData: TryoutAttemptData | undefined;
  effectiveStatus: TryoutAttemptStatus | undefined;
  nowMs: number;
  partKey: string;
  resumePartKey: string | undefined;
}) {
  const partAttempt =
    attemptData?.partAttempts.find((attempt) => attempt.partKey === partKey) ??
    null;
  const tryoutStatus = effectiveStatus ?? attemptData?.attempt.status;

  if (!(attemptData && tryoutStatus)) {
    const status = getTryoutSetPartStatus({
      expiresAtMs: attemptData?.expiresAtMs,
      isRuntimePending: false,
      nowMs,
      partAttempt,
      tryout: null,
    });

    return {
      isCurrent: status === "in-progress" || resumePartKey === partKey,
      status,
    };
  }

  const tryout = {
    completedPartIndices: attemptData.attempt.completedPartIndices,
    status: tryoutStatus,
  };
  const status = getTryoutSetPartStatus({
    expiresAtMs: attemptData?.expiresAtMs,
    isRuntimePending: false,
    nowMs,
    partAttempt,
    tryout,
  });

  return {
    isCurrent: status === "in-progress" || resumePartKey === partKey,
    status,
  };
}

export type TryoutPartPageState = ReturnType<typeof deriveTryoutPartPageState>;
