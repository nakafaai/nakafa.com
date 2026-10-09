import { previewRouting } from "@repo/internationalization/src/routing";
import { Array as Arr } from "effect";
import { hasLocale, type Locale } from "next-intl";

const ABSOLUTE_URL_REGEX = /^https?:\/\//;
const HASH_ONLY_REGEX = /^#/;
const MAIL_OR_TEL_REGEX = /^(mailto:|tel:)/;
const PROTOCOL_RELATIVE_REGEX = /^\/\//;
const URL_BASE = "https://nakafa.com";

/** Returns whether one href should bypass internal locale normalization. */
function shouldBypassInternalHrefNormalization(href: string) {
  if (!href) {
    return true;
  }

  if (HASH_ONLY_REGEX.test(href)) {
    return true;
  }

  if (MAIL_OR_TEL_REGEX.test(href)) {
    return true;
  }

  if (PROTOCOL_RELATIVE_REGEX.test(href)) {
    return true;
  }

  if (ABSOLUTE_URL_REGEX.test(href)) {
    return true;
  }

  return false;
}

/**
 * Normalize one internal href for locale-aware Next.js navigation.
 *
 * `next-intl` navigation helpers already prepend the request locale. When a
 * localized internal href like `/id/kurikulum/...` is pushed directly, the locale
 * can be duplicated. Candidate preview locales need the same normalization even
 * before activation, so this boundary recognizes every supported app locale.
 */
export function normalizeLocalizedInternalHref(href: string) {
  if (shouldBypassInternalHrefNormalization(href)) {
    return href;
  }

  const url = new URL(href, URL_BASE);
  const { locale, publicSegments } = splitLocalePathname(
    url.pathname,
    previewRouting.locales
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
