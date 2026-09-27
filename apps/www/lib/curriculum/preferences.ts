"use client";

import { QueryResult, useQuery } from "@confect/react";
import refs from "@repo/backend/confect/_generated/refs";
import { useConvexAuth } from "convex/react";

import type { Locale } from "next-intl";
import { getCurriculumProgramHref } from "@/lib/curriculum/routes";
import { isActiveLocale } from "@/lib/i18n/active";

/** Reads the current user's preferred curriculum href for client navigation. */
export function usePreferredCurriculumHref(locale: Locale) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const activeLocale = isActiveLocale(locale);
  const queryArgs =
    isAuthenticated && !isLoading && activeLocale ? { locale } : "skip";
  const preference = useQuery(
    refs.public.learningPreferences.queries.getCurrent,
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

  return getCurriculumProgramHref({
    locale,
    publicSlug: preference.value.program.publicSlug,
  });
}
