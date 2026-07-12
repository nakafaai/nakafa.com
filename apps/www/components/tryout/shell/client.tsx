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
  const country = getRouteParam(params.country);
  const exam = getRouteParam(params.exam);
  const set = getRouteParam(params.set);
  const track = getRouteParam(params.track);
  const setPath = getSetPath({
    country,
    exam,
    set,
    track,
  });
  const shouldLoadAttempt =
    !isLoading &&
    isAuthenticated &&
    locale !== null &&
    hasLocale(routing.locales, locale) &&
    setPath !== null;
  const attempt = useQuery(
    api.tryouts.queries.attempt.getCurrentByPublicPath,
    shouldLoadAttempt
      ? {
          locale,
          publicPath: setPath,
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

/** Builds the current set public path only when every route segment exists. */
function getSetPath({
  country,
  exam,
  set,
  track,
}: {
  country: string | null;
  exam: string | null;
  set: string | null;
  track: string | null;
}) {
  if (!country) {
    return null;
  }

  if (!exam) {
    return null;
  }

  if (!track) {
    return null;
  }

  if (!set) {
    return null;
  }

  return `try-out/${country}/${exam}/${track}/${set}`;
}
