import { PATHNAMES } from "@repo/internationalization/src/pathnames";
import type { Locale } from "use-intl";
import { curriculumTarget } from "@/lib/routing/target";

const curriculumPathnames = PATHNAMES["/curricula"];

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

/**
 * Returns the typed target of one curriculum program's root page. The route's
 * `curriculum` param is the program's public slug, and the empty splat leaves no
 * trailing segment. The locale is the one of the page on screen.
 */
export function getCurriculumProgramTarget(publicSlug: string) {
  return curriculumTarget({ curriculum: publicSlug, path: [] });
}
