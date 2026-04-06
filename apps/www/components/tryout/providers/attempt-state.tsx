"use client";

import type { api } from "@repo/backend/convex/_generated/api";
import type { Preloaded } from "convex/react";
import type { PropsWithChildren } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import {
  usePreloadedTryoutAttemptStateValue,
  useTryoutAttemptStateValue,
} from "@/components/tryout/hooks/use-attempt-state";
import type { TryoutAttemptParams } from "@/components/tryout/hooks/use-tryout-attempt";

type TryoutAttemptStateContextValue = ReturnType<
  typeof useTryoutAttemptStateValue
> & {
  params: TryoutAttemptParams;
};

const TryoutAttemptStateContext =
  createContext<TryoutAttemptStateContextValue | null>(null);

type PreloadedTryoutAttempt = Preloaded<
  typeof api.tryouts.queries.me.attempt.getUserTryoutAttempt
>;

/** Hydrates tryout attempt state from a server-preloaded authenticated query. */
function PreloadedTryoutAttemptStateProvider({
  children,
  initialNowMs,
  preloadedAttempt,
  ...params
}: PropsWithChildren<
  TryoutAttemptParams & {
    initialNowMs?: number;
    preloadedAttempt: PreloadedTryoutAttempt;
  }
>) {
  const value = usePreloadedTryoutAttemptStateValue({
    initialNowMs,
    preloadedAttempt,
  });

  return (
    <TryoutAttemptStateContext.Provider value={{ ...value, params }}>
      {children}
    </TryoutAttemptStateContext.Provider>
  );
}

/** Loads reactive tryout attempt state on the client when no preload is available. */
function LiveTryoutAttemptStateProvider({
  children,
  initialNowMs,
  ...params
}: PropsWithChildren<TryoutAttemptParams & { initialNowMs?: number }>) {
  const value = useTryoutAttemptStateValue({
    ...params,
    initialNowMs,
  });

  return (
    <TryoutAttemptStateContext.Provider value={{ ...value, params }}>
      {children}
    </TryoutAttemptStateContext.Provider>
  );
}

/** Provides shared tryout attempt state from either a preload or live query. */
export function TryoutAttemptStateProvider({
  children,
  initialNowMs,
  preloadedAttempt,
  ...params
}: PropsWithChildren<
  TryoutAttemptParams & {
    initialNowMs?: number;
    preloadedAttempt?: PreloadedTryoutAttempt;
  }
>) {
  if (preloadedAttempt) {
    return (
      <PreloadedTryoutAttemptStateProvider
        initialNowMs={initialNowMs}
        preloadedAttempt={preloadedAttempt}
        {...params}
      >
        {children}
      </PreloadedTryoutAttemptStateProvider>
    );
  }

  return (
    <LiveTryoutAttemptStateProvider initialNowMs={initialNowMs} {...params}>
      {children}
    </LiveTryoutAttemptStateProvider>
  );
}

/** Selects a slice of the shared tryout attempt state. */
export function useTryoutAttemptState<T>(
  selector: (state: TryoutAttemptStateContextValue) => T
) {
  return useContextSelector(TryoutAttemptStateContext, (context) => {
    if (!context) {
      throw new Error(
        "useTryoutAttemptState must be used within a TryoutAttemptStateProvider"
      );
    }

    return selector(context);
  });
}
