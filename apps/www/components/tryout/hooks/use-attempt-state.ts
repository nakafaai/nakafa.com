"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import { usePreloadedQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  type TryoutAttemptParams,
  useTryoutAttempt,
} from "@/components/tryout/hooks/use-tryout-attempt";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
import type { UseExerciseTimerReturn } from "@/lib/hooks/use-exercise-timer";

type TryoutAttemptData =
  | FunctionReturnType<
      typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt
    >
  | undefined;
type TryoutRemainingTime = UseExerciseTimerReturn["formatted"];
type PreloadedTryoutAttempt = Preloaded<
  typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt
>;

/** Derives shared CTA state from one resolved or pending tryout attempt source. */
function useResolvedTryoutAttemptStateValue({
  attemptData,
  initialNowMs,
  isAttemptPending,
}: {
  attemptData: TryoutAttemptData;
  initialNowMs?: number;
  isAttemptPending: boolean;
}) {
  const nowMs = useTryoutClock(
    Boolean(attemptData && attemptData.attempt.status === "in-progress"),
    initialNowMs
  );

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

/** Derives the current tryout CTA state from the user's latest attempt. */
export function useTryoutAttemptStateValue({
  initialNowMs,
  locale,
  product,
  tryoutSlug,
}: TryoutAttemptParams & { initialNowMs?: number }) {
  const { data: attemptData, isPending: isAttemptPending } = useTryoutAttempt(
    {
      locale,
      product,
      tryoutSlug,
    },
    initialNowMs
  );

  return useResolvedTryoutAttemptStateValue({
    attemptData,
    initialNowMs,
    isAttemptPending,
  });
}

/** Derives the current tryout CTA state from an authenticated preloaded attempt. */
export function usePreloadedTryoutAttemptStateValue({
  initialNowMs,
  preloadedAttempt,
}: {
  initialNowMs?: number;
  preloadedAttempt: PreloadedTryoutAttempt;
}) {
  const attemptData = usePreloadedQuery(preloadedAttempt);

  return useResolvedTryoutAttemptStateValue({
    attemptData,
    initialNowMs,
    isAttemptPending: false,
  });
}

export type TryoutAttemptStateValue = ReturnType<
  typeof useResolvedTryoutAttemptStateValue
>;
