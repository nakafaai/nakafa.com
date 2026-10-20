import {
  isInternalHref,
  normalizeLocalizedInternalHref,
} from "@repo/internationalization/src/href";
import type { Locale } from "@repo/internationalization/src/locale";
import { toCanonicalPath } from "@repo/internationalization/src/rewrite";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr } from "effect";

/**
 * The router path of an internal href on one locale, such as `/id/materials/x`
 * for `/materials/x`. A localized href keeps its locale out of the result, and
 * a public spelling becomes the canonical segment the router matches.
 */
export function localizedTarget(href: string, locale: Locale) {
  if (!isInternalHref(href)) {
    return href;
  }
  const url = new URL(normalizeLocalizedInternalHref(href), SITE_ORIGIN);
  const path = url.pathname === "/" ? "" : url.pathname;
  return `${toCanonicalPath(`/${locale}${path}`)}${url.search}${url.hash}`;
}

/**
 * The router path of a school-relative href. The school tree names the school
 * in its second segment, so `/exams` on `/school/harapan/home` becomes
 * `/school/harapan/exams`. A page outside the school tree keeps the href.
 */
export function schoolTarget(href: string, pathname: string) {
  const [, tree, slug] = pathname.split("/");
  if (!isInternalHref(href) || tree !== "school" || !slug) {
    return href;
  }
  const url = new URL(href, SITE_ORIGIN);
  const path = url.pathname === "/" ? "" : url.pathname;
  return `/school/${slug}${path}${url.search}${url.hash}`;
}

/**
 * The canonical path of an internal href on one locale, without the locale,
 * the query and the hash. It compares with the pathname the router reports.
 */
export function canonicalPathOf(href: string, locale: Locale) {
  const { pathname } = new URL(localizedTarget(href, locale), SITE_ORIGIN);
  const rest = Arr.join(Arr.drop(pathname.split("/"), 2), "/");
  return rest === "" ? "/" : `/${rest}`;
}
