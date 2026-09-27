"use client";

import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
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
  const preference = useQuery(
    refs.public.learningPreferences.queries.getCurrentTryout,
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
