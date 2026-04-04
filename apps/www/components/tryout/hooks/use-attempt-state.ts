"use client";

import {
  type TryoutAttemptParams,
  useTryoutAttempt,
} from "@/components/tryout/hooks/use-tryout-attempt";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
import type { UseExerciseTimerReturn } from "@/lib/hooks/use-exercise-timer";

type TryoutRemainingTime = UseExerciseTimerReturn["formatted"];

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
  } = useTryoutAttempt({
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
  const resumePartKey =
    effectiveStatus === "in-progress" ? attemptData?.resumePartKey : undefined;

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
