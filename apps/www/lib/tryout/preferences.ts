"use client";

import { api } from "@repo/backend/convex/_generated/api";
import { useQueryWithStatus } from "@repo/backend/helpers/react";
import { useConvexAuth } from "convex/react";
import type { Locale } from "next-intl";
import { getTryoutPublicPathHref } from "@/components/tryout/routes";

/** Reads the current user's preferred try-out country href for client navigation. */
export function usePreferredTryoutHref(locale: Locale) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const queryArgs = isAuthenticated && !isLoading ? { locale } : "skip";
  const preference = useQueryWithStatus(
    api.learningPreferences.queries.getCurrentTryout,
    queryArgs
  );

  if (!(preference.isSuccess && preference.data)) {
    return null;
  }

  return getTryoutPublicPathHref(preference.data.country.publicPath);
}
