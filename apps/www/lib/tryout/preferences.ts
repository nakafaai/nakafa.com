"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useConvexAuth } from "convex/react";
import type { Locale } from "next-intl";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { isActiveLocale } from "@/lib/i18n/active";

/** Reads the current user's preferred try-out country href for client navigation. */
export function usePreferredTryoutHref(locale: Locale) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const activeLocale = isActiveLocale(locale);
  const queryArgs =
    isAuthenticated && !isLoading && activeLocale ? { locale } : "skip";
  const preference = useQueryWithStatus(
    api.learningPreferences.queries.getCurrentTryout,
    queryArgs
  );

  if (!(activeLocale && preference.isSuccess && preference.data)) {
    return null;
  }

  return getTryoutPublicPathHref(preference.data.country.publicPath);
}
