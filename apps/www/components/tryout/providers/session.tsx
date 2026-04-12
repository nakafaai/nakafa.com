"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { Locale } from "next-intl";
import { useQueryState } from "nuqs";
import { useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { tryoutSearchParsers } from "@/components/tryout/utils/attempt-search";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
import { useUser } from "@/lib/context/use-user";

interface TryoutSessionContextValue {
  state: {
    isTryoutActive: boolean;
  };
}

const TryoutSessionContext = createContext<TryoutSessionContextValue | null>(
  null
);

/** Provides the shared shell state for tryout set and part routes. */
export function TryoutSessionProvider({
  children,
  locale,
  product,
  slug,
}: {
  children: React.ReactNode;
  locale: Locale;
  product: TryoutProduct;
  slug: string;
}) {
  const user = useUser((state) => state.user);
  const [selectedAttemptId] = useQueryState(
    "attempt",
    tryoutSearchParsers.attempt
  );
  const { data: session } = useQueryWithStatus(
    api.tryouts.queries.me.session.getUserTryoutSession,
    user
      ? {
          attemptId: selectedAttemptId ?? undefined,
          locale,
          product,
          tryoutSlug: slug,
        }
      : "skip"
  );
  const nowMs = useTryoutClock(Boolean(session?.status === "in-progress"));

  const value = useMemo(() => {
    const isTryoutActive = session
      ? getEffectiveTryoutStatus({
          expiresAtMs: session.expiresAtMs,
          nowMs,
          status: session.status,
        }) === "in-progress"
      : false;

    return {
      state: {
        isTryoutActive,
      },
    };
  }, [nowMs, session]);

  return (
    <TryoutSessionContext.Provider value={value}>
      {children}
    </TryoutSessionContext.Provider>
  );
}

/** Selects one slice of the shared tryout session-shell state. */
export function useTryoutSession<T>(
  selector: (state: TryoutSessionContextValue) => T
) {
  return useContextSelector(TryoutSessionContext, (context) => {
    if (!context) {
      throw new Error(
        "useTryoutSession must be used within a TryoutSessionProvider"
      );
    }

    return selector(context);
  });
}
