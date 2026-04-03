import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import {
  getEffectivePartAttemptStatus,
  getEffectiveTryoutStatus,
} from "@/components/tryout/utils/status";

type TryoutAttemptData = FunctionReturnType<
  typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt
>;

type TryoutPartRuntime = FunctionReturnType<
  typeof api.tryouts.queries.me.part.getUserTryoutPartAttempt
>;

type TryoutSetPartAttempt = Pick<
  NonNullable<TryoutAttemptData>["partAttempts"][number],
  "partIndex" | "score" | "setAttempt"
>;
type TryoutPartRuntimeAttempt = Pick<
  NonNullable<NonNullable<TryoutPartRuntime>["partAttempt"]>,
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

/** Derives the page-level UI status for one tryout part runtime. */
function getTryoutPartPageStatus({
  isRuntimePending,
  partAttempt,
  tryout,
}: {
  isRuntimePending: boolean;
  partAttempt: TryoutPartRuntimeAttempt | null;
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

/** Derives the list-row UI status for one tryout part entry. */
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
  partAttempt: TryoutSetPartAttempt | null;
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
    partAttempt?.setAttempt &&
    getEffectivePartAttemptStatus({
      expiresAtMs,
      nowMs,
      setAttempt: partAttempt.setAttempt,
    }) !== "in-progress"
  ) {
    return "ended";
  }

  if (partAttempt?.setAttempt?.status === "in-progress") {
    return "in-progress";
  }

  return "ready";
}

/** Derives the state needed to render a tryout part page. */
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
      score: null,
      status: getTryoutPartPageStatus({
        isRuntimePending,
        partAttempt,
        tryout: null,
      }),
      tryoutAttemptStatus: null,
      tryoutPublicResultStatus: null,
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
    score: runtime.partScore,
    status,
    tryoutAttemptStatus: runtime.tryoutAttempt.status,
    tryoutPublicResultStatus: runtime.tryoutAttempt.publicResultStatus,
  };
}

/** Derives the state needed to render one tryout part list item. */
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
    attemptData?.partAttempts.find(
      (attempt: NonNullable<TryoutAttemptData>["partAttempts"][number]) =>
        attempt.partKey === partKey
    ) ?? null;
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
      score: null,
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
    score: tryoutStatus === "in-progress" ? null : (partAttempt?.score ?? null),
    status,
  };
}

export type TryoutPartPageState = ReturnType<typeof deriveTryoutPartPageState>;
