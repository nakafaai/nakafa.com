"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { FunctionReturnType } from "convex/server";
import type { Locale } from "next-intl";
import { type ReactNode, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
import { useUser } from "@/lib/context/use-user";

type TryoutPackageStatus = Extract<
  FunctionReturnType<
    typeof api.tryouts.queries.me.packages.getUserTryoutPackageStatuses
  >[number]["status"],
  "completed" | "in-progress"
>;

const TryoutPackageProgressContext = createContext<ReadonlyMap<
  string,
  TryoutPackageStatus
> | null>(null);

export function useTryoutPackageProgress<T>(
  selector: (state: ReadonlyMap<string, TryoutPackageStatus>) => T
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
  tryoutSlugs: string[];
}

export function TryoutPackageProgressProvider({
  children,
  locale,
  product,
  tryoutSlugs,
}: TryoutPackageProgressProviderProps) {
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const shouldQuery = !isUserPending && Boolean(user) && tryoutSlugs.length > 0;
  const { data } = useQueryWithStatus(
    api.tryouts.queries.me.packages.getUserTryoutPackageStatuses,
    shouldQuery ? { locale, product, tryoutSlugs } : "skip"
  );
  const nowMs = useTryoutClock(Boolean(data && data.length > 0));
  const tryoutStatuses = useMemo(() => {
    const statuses = new Map<string, TryoutPackageStatus>();

    for (const tryout of data ?? []) {
      const effectiveStatus = getEffectiveTryoutStatus({
        expiresAtMs: tryout.expiresAtMs,
        nowMs,
        status: tryout.status,
      });

      if (effectiveStatus === "in-progress") {
        statuses.set(tryout.slug, "in-progress");
        continue;
      }

      statuses.set(tryout.slug, "completed");
    }

    return statuses;
  }, [data, nowMs]);

  return (
    <TryoutPackageProgressContext.Provider value={tryoutStatuses}>
      {children}
    </TryoutPackageProgressContext.Provider>
  );
}
