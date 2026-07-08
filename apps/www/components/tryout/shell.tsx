"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { routing } from "@repo/internationalization/src/routing";
import { useConvexAuth, useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { hasLocale } from "next-intl";
import type { ReactNode } from "react";
import { AppShell } from "@/components/sidebar/app-shell";

/** Locks the app shell while the current try-out attempt is running. */
export function TryoutShell({ children }: { children: ReactNode }) {
  const params = useParams();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const locale = getRouteParam(params.locale);
  const countryKey = getRouteParam(params.country);
  const examKey = getRouteParam(params.exam);
  const setKey = getRouteParam(params.set);
  const trackKey = getRouteParam(params.track);
  const shouldLoadAttempt =
    !isLoading &&
    isAuthenticated &&
    locale !== null &&
    hasLocale(routing.locales, locale) &&
    countryKey !== null &&
    examKey !== null &&
    setKey !== null &&
    trackKey !== null;
  const attempt = useQuery(
    api.tryouts.queries.attempt.getCurrent,
    shouldLoadAttempt
      ? {
          countryKey,
          examKey,
          locale,
          setKey,
          trackKey,
        }
      : "skip"
  );
  const locked = attempt?.status === "in-progress";

  if (shouldLoadAttempt && attempt === undefined) {
    return null;
  }

  return <AppShell locked={locked}>{children}</AppShell>;
}

/** Normalizes a Next.js route param into one stable segment value. */
function getRouteParam(param: string | string[] | undefined) {
  return typeof param === "string" ? param : null;
}
