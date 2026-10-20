import type { LinkTarget } from "@repo/internationalization/src/link";
import { PATHNAMES } from "@repo/internationalization/src/pathnames";
import { linkOptions } from "@tanstack/react-router";
import type { Locale } from "use-intl";

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
 * `curriculum` param is the program's public slug in the locale, and the empty
 * splat leaves no trailing segment.
 */
export function getCurriculumProgramTarget({
  locale,
  publicSlug,
}: {
  locale: Locale;
  publicSlug: string;
}): LinkTarget {
  return linkOptions({
    params: { _splat: "", curriculum: publicSlug, locale },
    to: "/$locale/curricula/$curriculum/$",
  });
}
