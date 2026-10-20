import { decodeLocale } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr, Option } from "effect";

const ABSOLUTE_URL_REGEX = /^https?:\/\//;
const NOT_INTERNAL_REGEX = /^(#|mailto:|tel:|\/\/)/;

/**
 * Whether an href leads inside the app. A hash, mail or telephone link, a
 * protocol-relative address and an absolute URL leave the router.
 */
export function isInternalHref(href: string) {
  return (
    href.length > 0 &&
    !NOT_INTERNAL_REGEX.test(href) &&
    !ABSOLUTE_URL_REGEX.test(href)
  );
}

/**
 * Normalize one internal href for locale-aware Next.js navigation.
 *
 * `the locale seam` navigation helpers already prepend the request locale. When a
 * localized internal href like `/id/kurikulum/...` is pushed directly, the locale
 * can be duplicated. Candidate preview locales need the same normalization even
 * before activation, so this boundary recognizes every supported app locale.
 */
export function normalizeLocalizedInternalHref(href: string) {
  if (!isInternalHref(href)) {
    return href;
  }

  const url = new URL(href, SITE_ORIGIN);
  const { locale, publicSegments } = splitLocalePathname(url.pathname);

  if (locale) {
    const localizedPath = Arr.join(publicSegments, "/");
    url.pathname = localizedPath ? `/${localizedPath}` : "/";
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Splits a pathname at the locale that leads it, when one of the public locales does.
 * The public segments are the non-empty segments after that locale, or every
 * non-empty segment when the pathname has no leading locale.
 */
export function splitLocalePathname(pathname: string) {
  const segments = Arr.filter(pathname.split("/"), Boolean);
  const locale = Option.getOrUndefined(decodeLocale(segments[0]));

  return {
    locale,
    publicSegments: locale ? Arr.drop(segments, 1) : segments,
  };
}
