"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
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
  const preference = useQueryWithStatus(
    api.learningPreferences.queries.getCurrent,
    queryArgs
  );

  if (!(activeLocale && preference.isSuccess && preference.data)) {
    return null;
  }

  return getCurriculumProgramHref({
    locale,
    publicSlug: preference.data.program.publicSlug,
  });
}
