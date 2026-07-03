"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import type { Locale } from "next-intl";
import { getCurriculumProgramHref } from "@/lib/curriculum/routes";

/** Reads the current user's preferred curriculum href for client navigation. */
export function usePreferredCurriculumHref(locale: Locale) {
  const preference = useQueryWithStatus(
    api.learningPreferences.queries.getCurrent,
    { locale }
  );

  if (!(preference.isSuccess && preference.data)) {
    return null;
  }

  return getCurriculumProgramHref({
    locale,
    publicSlug: preference.data.program.publicSlug,
  });
}
