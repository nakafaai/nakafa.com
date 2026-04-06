import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import {
  getEffectivePartAttemptStatus,
  getEffectiveTryoutStatus,
} from "./status";

type TryoutAttemptData = FunctionReturnType<
  typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt
>;

type TryoutPartRuntime = FunctionReturnType<
  typeof api.tryouts.queries.me.part.getUserTryoutPartAttempt
>;
type TryoutAttemptStatus = NonNullable<TryoutAttemptData>["attempt"]["status"];

interface TryoutPartAttemptLike {
  partIndex: number;
  setAttempt: {
    endReason?: string | null;
    startedAt?: number;
    status: "completed" | "expired" | "in-progress";
    timeLimit?: number;
  } | null;
}

interface TryoutProgress {
  completedPartIndices: number[];
  status: TryoutAttemptStatus;
}

export type TryoutPartUiStatus =
  | "completed"
  | "ended"
  | "in-progress"
  | "needs-tryout"
  | "ready";

/** Resolves the shared UI status for one tryout part attempt. */
function resolveTryoutPartStatus({
  expiresAtMs,
  nowMs,
  partAttempt,
  tryout,
}: {
  expiresAtMs: number | undefined;
  nowMs: number;
  partAttempt: TryoutPartAttemptLike | null;
  tryout: TryoutProgress | null;
}): TryoutPartUiStatus {
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

  if (!partAttempt) {
    return "ready";
  }

  if (!partAttempt.setAttempt) {
    return "ready";
  }

  return getEffectivePartAttemptStatus({
    expiresAtMs,
    nowMs,
    setAttempt: partAttempt.setAttempt,
  }) === "in-progress"
    ? "in-progress"
    : "ended";
}

/** Resolves the effective tryout progress shared by set and part route UIs. */
function getTryoutProgress({
  attempt,
  expiresAtMs,
  nowMs,
}: {
  attempt: Pick<
    NonNullable<TryoutAttemptData>["attempt"],
    "completedPartIndices" | "status"
  > | null;
  expiresAtMs: number | undefined;
  nowMs: number;
}): TryoutProgress | null {
  if (!(attempt && expiresAtMs !== undefined)) {
    return null;
  }

  return {
    completedPartIndices: attempt.completedPartIndices,
    status: getEffectiveTryoutStatus({
      expiresAtMs,
      nowMs,
      status: attempt.status,
    }),
  };
}

/** Derives the state needed to render a tryout part page. */
export function deriveTryoutPartPageState({
  nowMs,
  runtime,
}: {
  nowMs: number;
  runtime: TryoutPartRuntime | null;
}) {
  const partAttempt = runtime?.partAttempt ?? null;
  const tryout = getTryoutProgress({
    attempt: runtime?.tryoutAttempt ?? null,
    expiresAtMs: runtime?.expiresAtMs,
    nowMs,
  });
  const status = resolveTryoutPartStatus({
    expiresAtMs: runtime?.expiresAtMs,
    nowMs,
    partAttempt,
    tryout,
  });

  return {
    answers: partAttempt?.answers ?? [],
    attempt: partAttempt?.setAttempt ?? null,
    canStartPart: status === "ready",
    partEndReason: partAttempt?.setAttempt.endReason ?? null,
    score: runtime?.partScore ?? null,
    status,
    tryoutAttemptStatus: tryout?.status ?? null,
    tryoutPublicResultStatus: runtime?.tryoutAttempt.publicResultStatus ?? null,
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
  attemptData: TryoutAttemptData | null;
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
  const tryout = getTryoutProgress({
    attempt: attemptData?.attempt ?? null,
    expiresAtMs: attemptData?.expiresAtMs,
    nowMs,
  });
  const status = resolveTryoutPartStatus({
    expiresAtMs: attemptData?.expiresAtMs,
    nowMs,
    partAttempt,
    tryout:
      tryout && effectiveStatus
        ? {
            ...tryout,
            status: effectiveStatus,
          }
        : tryout,
  });

  return {
    isCurrent: status === "in-progress" || resumePartKey === partKey,
    score:
      effectiveStatus === "in-progress" ? null : (partAttempt?.score ?? null),
    status,
  };
}

export type TryoutPartPageState = ReturnType<typeof deriveTryoutPartPageState>;
