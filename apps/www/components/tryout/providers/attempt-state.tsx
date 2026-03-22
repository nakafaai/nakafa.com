"use client";

import type { PropsWithChildren } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useTryoutAttemptStateValue } from "@/components/tryout/hooks/use-attempt-state";
import type { TryoutAttemptParams } from "@/components/tryout/hooks/use-tryout-attempt";

type TryoutAttemptStateContextValue = ReturnType<
  typeof useTryoutAttemptStateValue
> & {
  params: TryoutAttemptParams;
};

const TryoutAttemptStateContext =
  createContext<TryoutAttemptStateContextValue | null>(null);

export function TryoutAttemptStateProvider({
  children,
  ...params
}: PropsWithChildren<TryoutAttemptParams>) {
  const value = useTryoutAttemptStateValue(params);

  return (
    <TryoutAttemptStateContext.Provider value={{ ...value, params }}>
      {children}
    </TryoutAttemptStateContext.Provider>
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
