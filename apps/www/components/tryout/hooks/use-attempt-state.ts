"use client";

import { useInterval } from "@mantine/hooks";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import type { Locale } from "next-intl";
import { useState } from "react";
import { useUserTryoutAttempt } from "@/components/tryout/hooks/use-user-tryout-attempt";

interface TryoutRemainingTime {
  hours: number;
  minutes: number;
  seconds: number;
}

export interface TryoutAttemptStateProps {
  locale: Locale;
  product: TryoutProduct;
  tryoutSlug: string;
}

/**
 * Derives the student-facing tryout CTA state from the latest tryout attempt.
 */
export function useTryoutAttemptState({
  locale,
  product,
  tryoutSlug,
}: TryoutAttemptStateProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { data: attemptData, isPending: isAttemptPending } =
    useUserTryoutAttempt({
      locale,
      product,
      tryoutSlug,
    });

  useInterval(
    () => {
      setNowMs(Date.now());
    },
    1000,
    { autoInvoke: true }
  );

  const isTryoutInProgress = attemptData?.attempt.status === "in-progress";
  const resumePartKey = isTryoutInProgress
    ? attemptData?.resumePartKey
    : undefined;

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
    isAttemptPending,
    resumePartKey,
    remainingTime,
  };
}
