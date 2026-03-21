"use client";

import { useInterval } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { Locale } from "next-intl";
import { useState } from "react";
import { useUser } from "@/lib/context/use-user";

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

export function useTryoutAttemptState({
  locale,
  product,
  tryoutSlug,
}: TryoutAttemptStateProps) {
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { data: attemptData, isPending: isAttemptPending } = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserTryoutAttempt,
    !isUserPending && user ? { locale, product, tryoutSlug } : "skip"
  );

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
