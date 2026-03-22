"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { Locale } from "next-intl";
import { type ReactNode, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useTryoutQueryNowMs } from "@/components/tryout/hooks/use-tryout-clock";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
import { useUser } from "@/lib/context/use-user";

const TryoutPackageProgressContext = createContext<ReadonlySet<string> | null>(
  null
);

export function useTryoutPackageProgress<T>(
  selector: (state: ReadonlySet<string>) => T
) {
  return useContextSelector(TryoutPackageProgressContext, (context) => {
    if (!context) {
      throw new Error(
        "useTryoutPackageProgress must be used within TryoutPackageProgressProvider"
      );
    }

    return selector(context);
  });
}

interface TryoutPackageProgressProviderProps {
  children: ReactNode;
  locale: Locale;
  product: TryoutProduct;
}

export function TryoutPackageProgressProvider({
  children,
  locale,
  product,
}: TryoutPackageProgressProviderProps) {
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const shouldQuery = !isUserPending && Boolean(user);
  const nowMs = useTryoutQueryNowMs(shouldQuery);
  const { data } = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserInProgressTryouts,
    shouldQuery ? { locale, product } : "skip"
  );
  const inProgressTryoutSlugs = useMemo(() => {
    const activeSlugs = new Set<string>();

    for (const tryout of data ?? []) {
      if (
        getEffectiveTryoutStatus({
          expiresAtMs: tryout.expiresAtMs,
          nowMs,
          status: "in-progress",
        }) !== "in-progress"
      ) {
        continue;
      }

      activeSlugs.add(tryout.slug);
    }

    return activeSlugs;
  }, [data, nowMs]);

  return (
    <TryoutPackageProgressContext.Provider value={inProgressTryoutSlugs}>
      {children}
    </TryoutPackageProgressContext.Provider>
  );
}
