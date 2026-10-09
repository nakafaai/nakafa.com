"use client";

import { QueryResult, useQuery } from "@confect/react";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import type { Locale } from "next-intl";
import { useConvexAuth } from "@/components/providers/convex";
import { getTryoutPublicPathHref } from "@/components/tryout/route/path";
import { isActiveLocale } from "@/lib/i18n/active";

/** Reads the current user's preferred try-out country href for client navigation. */
export function usePreferredTryoutHref(locale: Locale) {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const activeLocale = isActiveLocale(locale);
  const queryArgs =
    isAuthenticated && !isLoading && activeLocale ? { locale } : "skip";
  const preference = useQuery(
    learningPreferences.queries.getCurrentTryout,
    queryArgs
  );

  if (QueryResult.isFailure(preference)) {
    throw preference.error;
  }

  if (
    !(activeLocale && QueryResult.isSuccess(preference) && preference.value)
  ) {
    return null;
  }

  return getTryoutPublicPathHref(preference.value.country.publicPath);
}
