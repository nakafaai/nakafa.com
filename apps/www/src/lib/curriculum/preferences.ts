import { QueryResult, useQuery } from "@confect/react";
import learningPreferences from "@repo/backend/confect/_generated/refs/learningPreferences";
import { Option } from "effect";
import type { Locale } from "use-intl";
import { useConvexAuth } from "@/components/auth/convex";
import { getCurriculumProgramTarget } from "@/lib/curriculum/routes";
import { isActiveLocale } from "@/lib/i18n/active";
import type { LinkTarget } from "@/lib/routing/link";

/** Reads the current user's preferred curriculum program as a typed link target. */
export function usePreferredCurriculumTarget(
  locale: Locale
): Option.Option<LinkTarget> {
  const isAuthenticated = useConvexAuth((auth) => auth.isAuthenticated);
  const isLoading = useConvexAuth((auth) => auth.isLoading);
  const activeLocale = isActiveLocale(locale);
  const queryArgs =
    isAuthenticated && !isLoading && activeLocale ? { locale } : "skip";
  const preference = useQuery(
    learningPreferences.queries.getCurrent,
    queryArgs
  );

  if (QueryResult.isFailure(preference)) {
    throw preference.error;
  }

  if (
    !(activeLocale && QueryResult.isSuccess(preference) && preference.value)
  ) {
    return Option.none();
  }

  return Option.some(
    getCurriculumProgramTarget(preference.value.program.publicSlug)
  );
}
