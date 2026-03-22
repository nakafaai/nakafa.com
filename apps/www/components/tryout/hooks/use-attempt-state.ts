"use client";

import {
  type TryoutAttemptParams,
  useUserTryoutAttempt,
} from "@/components/tryout/hooks/use-tryout-attempt";
import {
  getEffectivePartAttemptStatus,
  getEffectiveTryoutStatus,
} from "@/components/tryout/utils/status";
import type { UseExerciseTimerReturn } from "@/lib/hooks/use-exercise-timer";

type TryoutRemainingTime = UseExerciseTimerReturn["formatted"];

/** Picks the next part key the student should resume in an active tryout. */
function getResumePartKey({
  attemptData,
  effectiveStatus,
  nowMs,
}: {
  attemptData: ReturnType<typeof useUserTryoutAttempt>["data"] | undefined;
  effectiveStatus: ReturnType<typeof getEffectiveTryoutStatus> | undefined;
  nowMs: number;
}) {
  if (!(attemptData && effectiveStatus === "in-progress")) {
    return undefined;
  }

  const activePartAttempts = attemptData.partAttempts.filter(
    (partAttempt) =>
      getEffectivePartAttemptStatus({
        expiresAtMs: attemptData.expiresAtMs,
        nowMs,
        setAttempt: partAttempt.setAttempt,
      }) === "in-progress"
  );

  if (activePartAttempts.length === 0) {
    const locallyEndedPartIndices = new Set(
      attemptData.attempt.completedPartIndices
    );

    for (const partAttempt of attemptData.partAttempts) {
      if (locallyEndedPartIndices.has(partAttempt.partIndex)) {
        continue;
      }

      if (
        getEffectivePartAttemptStatus({
          expiresAtMs: attemptData.expiresAtMs,
          nowMs,
          setAttempt: partAttempt.setAttempt,
        }) === "in-progress"
      ) {
        continue;
      }

      locallyEndedPartIndices.add(partAttempt.partIndex);
    }

    const nextAvailablePart = attemptData.orderedParts.find(
      (part) => !locallyEndedPartIndices.has(part.partIndex)
    );

    return nextAvailablePart?.partKey;
  }

  activePartAttempts.sort(
    (left, right) =>
      right.setAttempt.lastActivityAt - left.setAttempt.lastActivityAt
  );

  return activePartAttempts[0]?.partKey;
}

/** Derives the current tryout CTA state from the user's latest attempt. */
export function useTryoutAttemptStateValue({
  locale,
  product,
  tryoutSlug,
}: TryoutAttemptParams) {
  const {
    data: attemptData,
    isPending: isAttemptPending,
    nowMs,
  } = useUserTryoutAttempt({
    locale,
    product,
    tryoutSlug,
  });

  const effectiveStatus = attemptData
    ? getEffectiveTryoutStatus({
        expiresAtMs: attemptData.expiresAtMs,
        nowMs,
        status: attemptData.attempt.status,
      })
    : undefined;
  const isTryoutInProgress = effectiveStatus === "in-progress";
  const resumePartKey = getResumePartKey({
    attemptData,
    effectiveStatus,
    nowMs,
  });

  let remainingTime: TryoutRemainingTime | null = null;

  if (attemptData && isTryoutInProgress) {
    const totalSeconds = Math.max(
      0,
      Math.floor((attemptData.expiresAtMs - nowMs) / 1000)
    );

    remainingTime = {
      hours: Math.floor(totalSeconds / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  }

  return {
    attemptData,
    effectiveStatus,
    isAttemptPending,
    nowMs,
    resumePartKey,
    remainingTime,
  };
}

export type TryoutAttemptStateValue = ReturnType<
  typeof useTryoutAttemptStateValue
>;
