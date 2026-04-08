"use client";

import { usePreloadedAuthQuery } from "@convex-dev/better-auth/nextjs/client";
import type { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { type PropsWithChildren, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { useTryoutStartFlow } from "@/components/tryout/hooks/use-tryout-start-flow";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
import type { UseExerciseTimerReturn } from "@/lib/hooks/use-exercise-timer";

type TryoutAttemptData = FunctionReturnType<
  typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt
>;
type PreloadedTryoutAttempt = Preloaded<
  typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt
>;
type TryoutRemainingTime = UseExerciseTimerReturn["formatted"];

export type TryoutSetParams = FunctionArgs<
  typeof api.tryouts.mutations.attempts.startTryout
>;

interface TryoutSetContextValue {
  actions: {
    clickStartAction: () => void;
    confirmStartAction: () => void;
    prefetchAuthAction: () => void;
    setDialogOpenAction: (open: boolean) => void;
  };
  meta: {
    isActionPending: boolean;
    isDialogOpen: boolean;
    isStartBlocked: boolean;
  };
  params: TryoutSetParams;
  state: {
    attempt: NonNullable<TryoutAttemptData>["attempt"] | null;
    attemptData: TryoutAttemptData | null;
    effectiveStatus: ReturnType<typeof getEffectiveTryoutStatus> | undefined;
    hasFinishedAttempt: boolean;
    isTryoutActive: boolean;
    nowMs: number;
    remainingTime: TryoutRemainingTime | null;
    resumePartKey: string | undefined;
  };
}

const TryoutSetContext = createContext<TryoutSetContextValue | null>(null);

/** Converts the active attempt expiry into a visible countdown value. */
function getRemainingTime({
  attemptData,
  effectiveStatus,
  nowMs,
}: {
  attemptData: TryoutAttemptData | null;
  effectiveStatus: ReturnType<typeof getEffectiveTryoutStatus> | undefined;
  nowMs: number;
}) {
  if (!(attemptData && effectiveStatus === "in-progress")) {
    return null;
  }

  const totalSeconds = Math.max(
    0,
    Math.floor((attemptData.expiresAtMs - nowMs) / 1000)
  );

  return {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

/** Builds the full set-route state from one server-owned attempt snapshot. */
function useResolvedTryoutSetValue({
  attemptData,
  hasAuthenticatedRoute,
  initialNowMs,
  partKeys,
  params,
}: {
  attemptData: TryoutAttemptData | null;
  hasAuthenticatedRoute: boolean;
  initialNowMs?: number;
  partKeys: readonly string[];
  params: TryoutSetParams;
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
  const hasFinishedAttempt = Boolean(
    attemptData && effectiveStatus !== "in-progress"
  );
  const isTryoutActive = effectiveStatus === "in-progress";
  const resumePartKey =
    effectiveStatus === "in-progress" ? attemptData?.resumePartKey : undefined;
  const remainingTime = getRemainingTime({
    attemptData,
    effectiveStatus,
    nowMs,
  });
  const {
    clickStartAction,
    confirmStartAction,
    isActionPending,
    isDialogOpen,
    isStartBlocked,
    prefetchAuthAction,
    setDialogOpenAction,
  } = useTryoutStartFlow({
    access: hasAuthenticatedRoute ? "authenticated" : "anonymous",
    partKeys,
    params,
    resumePartKey,
  });

  return useMemo(
    () => ({
      actions: {
        clickStartAction,
        confirmStartAction,
        prefetchAuthAction,
        setDialogOpenAction,
      },
      meta: {
        isActionPending,
        isDialogOpen,
        isStartBlocked,
      },
      params,
      state: {
        attempt: attemptData?.attempt ?? null,
        attemptData,
        effectiveStatus,
        hasFinishedAttempt,
        isTryoutActive,
        nowMs,
        remainingTime,
        resumePartKey,
      },
    }),
    [
      attemptData,
      clickStartAction,
      confirmStartAction,
      effectiveStatus,
      hasFinishedAttempt,
      isTryoutActive,
      isActionPending,
      isDialogOpen,
      isStartBlocked,
      nowMs,
      params,
      prefetchAuthAction,
      remainingTime,
      resumePartKey,
      setDialogOpenAction,
    ]
  );
}

/** Hydrates one authenticated set route from its server-preloaded attempt. */
function PreloadedTryoutSetProvider({
  children,
  initialNowMs,
  partKeys,
  params,
  preloadedAttempt,
}: PropsWithChildren<{
  initialNowMs?: number;
  partKeys: readonly string[];
  params: TryoutSetParams;
  preloadedAttempt: PreloadedTryoutAttempt;
}>) {
  const attemptData = usePreloadedAuthQuery(preloadedAttempt) ?? null;
  const value = useResolvedTryoutSetValue({
    attemptData,
    hasAuthenticatedRoute: true,
    initialNowMs,
    partKeys,
    params,
  });

  return (
    <TryoutSetContext.Provider value={value}>
      {children}
    </TryoutSetContext.Provider>
  );
}

/** Provides the anonymous set route state when no authenticated preload exists. */
function AnonymousTryoutSetProvider({
  children,
  initialNowMs,
  partKeys,
  params,
}: PropsWithChildren<{
  initialNowMs?: number;
  partKeys: readonly string[];
  params: TryoutSetParams;
}>) {
  const value = useResolvedTryoutSetValue({
    attemptData: null,
    hasAuthenticatedRoute: false,
    initialNowMs,
    partKeys,
    params,
  });

  return (
    <TryoutSetContext.Provider value={value}>
      {children}
    </TryoutSetContext.Provider>
  );
}

/** Provides the full set-route state from the server-authenticated route snapshot. */
export function TryoutSetProvider({
  children,
  initialNowMs,
  partKeys,
  params,
  preloadedAttempt,
}: PropsWithChildren<{
  initialNowMs?: number;
  partKeys: readonly string[];
  params: TryoutSetParams;
  preloadedAttempt?: PreloadedTryoutAttempt;
}>) {
  if (preloadedAttempt) {
    return (
      <PreloadedTryoutSetProvider
        initialNowMs={initialNowMs}
        params={params}
        partKeys={partKeys}
        preloadedAttempt={preloadedAttempt}
      >
        {children}
      </PreloadedTryoutSetProvider>
    );
  }

  return (
    <AnonymousTryoutSetProvider
      initialNowMs={initialNowMs}
      params={params}
      partKeys={partKeys}
    >
      {children}
    </AnonymousTryoutSetProvider>
  );
}

/** Selects one slice of the route-owned tryout set state. */
export function useTryoutSet<T>(selector: (state: TryoutSetContextValue) => T) {
  return useContextSelector(TryoutSetContext, (context) => {
    if (!context) {
      throw new Error("useTryoutSet must be used within a TryoutSetProvider");
    }

    return selector(context);
  });
}
