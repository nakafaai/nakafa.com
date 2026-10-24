import { APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import {
  toCanonicalPath,
  toPublicPath,
} from "@repo/internationalization/src/rewrite";
import { SITE_ORIGIN } from "@repo/seo/origin";
import { Array as Arr } from "effect";
import { hasLocale, type Locale } from "use-intl/core";

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
 * Normalize one internal href for locale-aware navigation.
 *
 * The locale helpers already prepend the request locale. When a localized
 * internal href like `/id/kurikulum/...` is passed directly, the locale would be
 * duplicated. Candidate preview locales need the same normalization even before
 * activation, so this boundary recognizes every supported app locale.
 */
export function normalizeLocalizedInternalHref(href: string) {
  if (!isInternalHref(href)) {
    return href;
  }

  const url = new URL(href, SITE_ORIGIN);
  const { locale, publicSegments } = splitLocalePathname(
    url.pathname,
    APP_LOCALE_CODES
  );

  if (locale) {
    const localizedPath = Arr.join(publicSegments, "/");
    url.pathname = localizedPath ? `/${localizedPath}` : "/";
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Splits a pathname at the locale that leads it, when one of `locales` does.
 * The public segments are the non-empty segments after that locale, or every
 * non-empty segment when the pathname has no leading locale.
 */
export function splitLocalePathname<LocaleType extends Locale>(
  pathname: string,
  locales: readonly LocaleType[]
) {
  const segments = Arr.filter(pathname.split("/"), Boolean);
  const firstSegment = segments[0];
  const locale =
    firstSegment && hasLocale(locales, firstSegment) ? firstSegment : undefined;

  return {
    locale,
    publicSegments: locale ? Arr.drop(segments, 1) : segments,
  };
}

/**
 * The router href of an authored internal href on one locale, such as
 * `/id/materi/x` for `/materi/x`. The router reads a public spelling and maps
 * it to its own route, so the href keeps the spelling the author wrote.
 */
export function localizeInternalHref(href: string, locale: Locale) {
  const url = new URL(normalizeLocalizedInternalHref(href), SITE_ORIGIN);
  const path = url.pathname === "/" ? "" : url.pathname;
  return `/${locale}${path}${url.search}${url.hash}`;
}

/**
 * The public path of an internal href on one locale, as the address bar shows
 * it, such as `/id/kurikulum/merdeka` for `/curricula/merdeka`. A server reads it
 * where no router runs, so it is the same mapping the router's rewrite applies.
 */
export function publicInternalHref(href: string, locale: Locale) {
  return toPublicPath(toCanonicalPath(localizeInternalHref(href, locale)));
}
