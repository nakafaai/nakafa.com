"use client";

import { useInterval } from "@mantine/hooks";
import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@/lib/context/use-user";

type TryoutAttemptData = FunctionReturnType<
  typeof api.tryouts.queries.attempts.getUserTryoutAttempt
>;

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
  const lastReconciledPartKeyRef = useRef<string | null>(null);
  const { data: attemptData, isPending: isAttemptPending } = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserTryoutAttempt,
    !isUserPending && user ? { locale, product, tryoutSlug } : "skip"
  );
  const completePart = useMutation(api.tryouts.mutations.attempts.completePart);

  useInterval(
    () => {
      setNowMs(Date.now());
    },
    1000,
    { autoInvoke: true }
  );

  const isTryoutActive = Boolean(
    attemptData?.attempt.status === "in-progress" &&
      attemptData.expiresAtMs > nowMs
  );
  const nextPartKey = isTryoutActive ? attemptData?.nextPartKey : undefined;

  let remainingTime: TryoutRemainingTime | null = null;

  if (attemptData && isTryoutActive) {
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

  let pendingExpiredPart:
    | NonNullable<TryoutAttemptData>["partAttempts"][number]
    | null = null;

  if (attemptData && isTryoutActive) {
    pendingExpiredPart =
      attemptData.partAttempts.find((partAttempt) => {
        if (attemptData.completedPartIndices.includes(partAttempt.partIndex)) {
          return false;
        }

        if (partAttempt.setAttempt.status !== "in-progress") {
          return false;
        }

        const expiresAtMs =
          partAttempt.setAttempt.startedAt +
          partAttempt.setAttempt.timeLimit * 1000;

        return nowMs >= expiresAtMs;
      }) ?? null;
  }

  useEffect(() => {
    if (!(attemptData && pendingExpiredPart)) {
      lastReconciledPartKeyRef.current = null;
      return;
    }

    if (lastReconciledPartKeyRef.current === pendingExpiredPart.partKey) {
      return;
    }

    lastReconciledPartKeyRef.current = pendingExpiredPart.partKey;
    completePart({
      partKey: pendingExpiredPart.partKey,
      tryoutAttemptId: attemptData.attempt._id,
    }).catch(() => {
      lastReconciledPartKeyRef.current = null;
    });
  }, [attemptData, completePart, pendingExpiredPart]);

  return {
    attemptData,
    isAttemptPending,
    nextPartKey,
    nowMs,
    remainingTime,
  };
}
