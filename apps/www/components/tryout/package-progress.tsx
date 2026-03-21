"use client";

import { api } from "@repo/backend/convex/_generated/api";
import type { TryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { Badge } from "@repo/design-system/components/ui/badge";
import type { Locale } from "next-intl";
import { useTranslations } from "next-intl";
import { type ReactNode, useMemo } from "react";
import { createContext, useContextSelector } from "use-context-selector";
import { useUser } from "@/lib/context/use-user";

const TryoutPackageProgressContext = createContext<ReadonlySet<string> | null>(
  null
);

interface TryoutPackageProgressProviderProps {
  children: ReactNode;
  locale: Locale;
  product: TryoutProduct;
}

/**
 * Loads the current user's in-progress tryout slugs for one product page.
 */
export function TryoutPackageProgressProvider({
  children,
  locale,
  product,
}: TryoutPackageProgressProviderProps) {
  const isUserPending = useUser((state) => state.isPending);
  const user = useUser((state) => state.user);
  const { data } = useQueryWithStatus(
    api.tryouts.queries.attempts.getUserInProgressTryoutSlugs,
    !isUserPending && user ? { locale, product } : "skip"
  );
  const inProgressTryoutSlugs = useMemo(() => new Set(data ?? []), [data]);

  return (
    <TryoutPackageProgressContext.Provider value={inProgressTryoutSlugs}>
      {children}
    </TryoutPackageProgressContext.Provider>
  );
}

/**
 * Shows a short badge when a tryout set is still running for the current user.
 */
export function TryoutPackageInProgressBadge({
  tryoutSlug,
}: {
  tryoutSlug: string;
}) {
  const tTryouts = useTranslations("Tryouts");
  const isInProgress = useIsTryoutInProgress(tryoutSlug);

  if (!isInProgress) {
    return null;
  }

  return (
    <Badge variant="muted">{tTryouts("package-status-in-progress")}</Badge>
  );
}

/**
 * Returns whether one tryout slug is still in progress.
 */
function useIsTryoutInProgress(tryoutSlug: string) {
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
      "useIsTryoutInProgress must be used within TryoutPackageProgressProvider"
    );
  }

  return isInProgress;
}
