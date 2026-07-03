"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useConvexAuth } from "convex/react";
import type { Locale } from "next-intl";
import { getCurriculumProgramHref } from "@/lib/curriculum/routes";

/** Reads the signed-in user's preferred curriculum href for client navigation. */
export function usePreferredCurriculumHref(locale: Locale) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const shouldLoadPreference = isAuthenticated && !isLoading;
  const preference = useQueryWithStatus(
    api.learningPreferences.queries.getCurrent,
    shouldLoadPreference ? { locale } : "skip"
  );

  if (!(preference.isSuccess && preference.data)) {
    return null;
  }

  return getCurriculumProgramHref({
    locale,
    publicSlug: preference.data.program.publicSlug,
  });
}
