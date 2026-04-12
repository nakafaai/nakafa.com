"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { isTryoutProduct } from "@repo/backend/convex/tryouts/products";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { routing } from "@repo/internationalization/src/routing";
import { useParams } from "next/navigation";
import { hasLocale } from "next-intl";
import { useQueryState } from "nuqs";
import { AppShell } from "@/components/sidebar/app-shell";
import { useTryoutClock } from "@/components/tryout/hooks/use-tryout-clock";
import { tryoutSearchParsers } from "@/components/tryout/utils/attempt-search";
import { getEffectiveTryoutStatus } from "@/components/tryout/utils/status";
import { useUser } from "@/lib/context/use-user";

/** Renders one shared tryout shell and derives its locked state from the current route. */
export function TryoutShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const user = useUser((state) => state.user);
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

  const { data: session } = useQueryWithStatus(
    api.tryouts.queries.me.session.getUserTryoutSession,
    user && isSessionRoute
      ? {
          attemptId: selectedAttemptId ?? undefined,
          locale,
          product,
          tryoutSlug: slug,
        }
      : "skip"
  );
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
