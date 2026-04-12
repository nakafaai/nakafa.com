"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import { preloadedQueryResult } from "convex/nextjs";
import { type Preloaded, useConvexAuth, usePreloadedQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { type PropsWithChildren, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { useTryoutStartFlow } from "@/components/tryout/hooks/use-tryout-start-flow";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
import type { UseExerciseTimerReturn } from "@/lib/hooks/use-exercise-timer";

type TryoutSetViewData = FunctionReturnType<
  typeof api.tryouts.queries.me.setView.getUserTryoutSetView
>;
type PreloadedTryoutSetView = Preloaded<
  typeof api.tryouts.queries.me.setView.getUserTryoutSetView
>;
type TryoutSetAttemptData = NonNullable<TryoutSetViewData>["attemptData"];
type TryoutRemainingTime = UseExerciseTimerReturn["formatted"];
type InitialTryoutAttemptHistory = NonNullable<
  NonNullable<TryoutSetViewData>["initialHistory"]["page"]
>;

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
    attempt: TryoutSetAttemptData["attempt"] | null;
    attemptData: TryoutSetAttemptData | null;
    effectiveStatus: ReturnType<typeof getEffectiveTryoutStatus> | undefined;
    hasFinishedAttempt: boolean;
    initialAttemptHistory: InitialTryoutAttemptHistory;
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
  attemptData: TryoutSetAttemptData | null;
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
  hasAuthenticatedRoute,
  initialNowMs,
  partKeys,
  params,
  setViewData,
}: {
  hasAuthenticatedRoute: boolean;
  initialNowMs?: number;
  partKeys: readonly string[];
  params: TryoutSetParams;
  setViewData: TryoutSetViewData | null;
}) {
  const attemptData = setViewData?.attemptData ?? null;
  const initialAttemptHistory = setViewData?.initialHistory.page ?? [];
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
        initialAttemptHistory,
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
      initialAttemptHistory,
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

/** Resolves one set-route context from already available route state. */
function ResolvedTryoutSetProvider({
  children,
  hasAuthenticatedRoute,
  initialNowMs,
  partKeys,
  params,
  setViewData,
}: PropsWithChildren<{
  hasAuthenticatedRoute: boolean;
  initialNowMs?: number;
  partKeys: readonly string[];
  params: TryoutSetParams;
  setViewData: TryoutSetViewData | null;
}>) {
  const value = useResolvedTryoutSetValue({
    hasAuthenticatedRoute,
    initialNowMs,
    partKeys,
    params,
    setViewData,
  });

  return (
    <TryoutSetContext.Provider value={value}>
      {children}
    </TryoutSetContext.Provider>
  );
}

/** Subscribes the authenticated set route to its live vanilla Convex query. */
function LivePreloadedTryoutSetProvider({
  children,
  initialNowMs,
  partKeys,
  params,
  preloadedSetView,
}: PropsWithChildren<{
  initialNowMs?: number;
  partKeys: readonly string[];
  params: TryoutSetParams;
  preloadedSetView: PreloadedTryoutSetView;
}>) {
  const setViewData = usePreloadedQuery(preloadedSetView) ?? null;

  return (
    <ResolvedTryoutSetProvider
      hasAuthenticatedRoute
      initialNowMs={initialNowMs}
      params={params}
      partKeys={partKeys}
      setViewData={setViewData}
    >
      {children}
    </ResolvedTryoutSetProvider>
  );
}

/** Hydrates one authenticated set route from its native Convex preload. */
function PreloadedTryoutSetProvider({
  children,
  initialNowMs,
  partKeys,
  params,
  preloadedSetView,
}: PropsWithChildren<{
  initialNowMs?: number;
  partKeys: readonly string[];
  params: TryoutSetParams;
  preloadedSetView: PreloadedTryoutSetView;
}>) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const initialSetViewData = useMemo(
    () => preloadedQueryResult(preloadedSetView),
    [preloadedSetView]
  );

  /**
   * Keep tryout route hydration on vanilla Convex primitives.
   *
   * `usePreloadedQuery()` eagerly starts the live query as soon as it mounts
   * (`convex/src/react/hydration.tsx`). That behavior is correct only after the
   * Convex auth client is ready. Returning from an external checkout like Polar
   * can briefly leave the browser in an authenticated-but-still-loading state,
   * which is when the protected `me.*` queries used to throw `Unauthenticated`.
   *
   * The route already owns a server snapshot, so the safest and least invasive
   * fix is to keep rendering that snapshot while auth is loading and only mount
   * the reactive vanilla Convex query once auth is ready.
   */
  if (isLoading) {
    return (
      <ResolvedTryoutSetProvider
        hasAuthenticatedRoute
        initialNowMs={initialNowMs}
        params={params}
        partKeys={partKeys}
        setViewData={initialSetViewData}
      >
        {children}
      </ResolvedTryoutSetProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <ResolvedTryoutSetProvider
        hasAuthenticatedRoute={false}
        initialNowMs={initialNowMs}
        params={params}
        partKeys={partKeys}
        setViewData={null}
      >
        {children}
      </ResolvedTryoutSetProvider>
    );
  }

  return (
    <LivePreloadedTryoutSetProvider
      initialNowMs={initialNowMs}
      params={params}
      partKeys={partKeys}
      preloadedSetView={preloadedSetView}
    >
      {children}
    </LivePreloadedTryoutSetProvider>
  );
}

/** Provides the full set-route state from the server-authenticated route snapshot. */
export function TryoutSetProvider({
  children,
  initialNowMs,
  partKeys,
  params,
  preloadedSetView,
}: PropsWithChildren<{
  initialNowMs?: number;
  partKeys: readonly string[];
  params: TryoutSetParams;
  preloadedSetView?: PreloadedTryoutSetView;
}>) {
  if (preloadedSetView) {
    return (
      <PreloadedTryoutSetProvider
        initialNowMs={initialNowMs}
        params={params}
        partKeys={partKeys}
        preloadedSetView={preloadedSetView}
      >
        {children}
      </PreloadedTryoutSetProvider>
    );
  }

  return (
    <ResolvedTryoutSetProvider
      hasAuthenticatedRoute={false}
      initialNowMs={initialNowMs}
      params={params}
      partKeys={partKeys}
      setViewData={null}
    >
      {children}
    </ResolvedTryoutSetProvider>
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
