import { routing } from "@repo/internationalization/src/routing";
import type { Locale } from "next-intl";

const curriculumPathnames = routing.pathnames["/curricula"];

/** Returns the localized curriculum index href without a locale prefix. */
export function getCurriculumIndexHref(locale: Locale) {
  return curriculumPathnames[locale];
}

/** Returns the localized root href for one curriculum program public slug. */
export function getCurriculumProgramHref({
  locale,
  publicSlug,
}: {
  locale: Locale;
  publicSlug: string;
}) {
  return `${getCurriculumIndexHref(locale)}/${publicSlug}`;
}
