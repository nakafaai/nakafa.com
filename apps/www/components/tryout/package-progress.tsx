"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Badge } from "@repo/design-system/components/ui/badge";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useTryoutQueryNowMs } from "@/components/tryout/hooks/use-query-now-ms";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
import { useUser } from "@/lib/context/use-user";

const TryoutPackageProgressContext = createContext<ReadonlySet<string> | null>(
  null
);

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

export function TryoutPackageInProgressBadge({
  tryoutSlug,
}: {
  tryoutSlug: string;
}) {
  const tTryouts = useTranslations("Tryouts");
  const hasProvider = useContextSelector(
    TryoutPackageProgressContext,
    (value) => value !== null
  );
  const isInProgress = useContextSelector(
    TryoutPackageProgressContext,
    (value) => value?.has(tryoutSlug) ?? false
  );

  if (!hasProvider) {
    throw new Error(
      "TryoutPackageInProgressBadge must be used within TryoutPackageProgressProvider"
    );
  }

  if (!isInProgress) {
    return null;
  }

  return (
    <Badge variant="muted">{tTryouts("package-status-in-progress")}</Badge>
  );
}
