"use client";

import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { isTryoutProduct } from "@repo/backend/confect/modules/tryout/products";
import { routing } from "@repo/internationalization/src/routing";
import { useConvexAuth } from "convex/react";
import { useParams } from "next/navigation";
import { hasLocale } from "next-intl";
import { useQueryState } from "nuqs";
import { AppShell } from "@/components/sidebar/app-shell";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { tryoutSearchParsers } from "@/components/tryout/utils/attempt-search";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";

/** Renders one shared tryout shell and derives its locked state from the current route. */
export function TryoutShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [selectedAttemptId] = useQueryState(
    "attempt",
    tryoutSearchParsers.attempt
  );

  const locale = typeof params.locale === "string" ? params.locale : null;
  const product = typeof params.product === "string" ? params.product : null;
  const slug = typeof params.slug === "string" ? params.slug : null;
  const isSessionRoute =
    locale !== null &&
    hasLocale(routing.locales, locale) &&
    product !== null &&
    isTryoutProduct(product) &&
    slug !== null;
  const shouldLoadSession = isSessionRoute && !isLoading && isAuthenticated;

  const sessionResult = useQuery(
    refs.public.tryouts.queries.me.session.getUserTryoutSession,
    shouldLoadSession
      ? {
          attemptId: selectedAttemptId ?? undefined,
          locale,
          product,
          tryoutSlug: slug,
        }
      : "skip"
  );
  const session = QueryResult.isSuccess(sessionResult)
    ? sessionResult.value
    : undefined;
  const nowMs = useTryoutClock(Boolean(session?.status === "in-progress"));

  const locked =
    session !== null &&
    session !== undefined &&
    getEffectiveTryoutStatus({
      expiresAtMs: session.expiresAtMs,
      nowMs,
      status: session.status,
    }) === "in-progress";

  return <AppShell locked={locked}>{children}</AppShell>;
}
