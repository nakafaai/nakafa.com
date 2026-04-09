import { hasLocale } from "next-intl";
import { routing } from "./routing";

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
 * `next-intl` navigation helpers already prepend the active locale. When a
 * localized internal href like `/id/subject/...` is pushed directly, the locale
 * can be duplicated. This helper strips the leading locale segment and keeps the
 * remaining pathname, query, and hash intact.
 */
export function normalizeLocalizedInternalHref(href: string) {
  if (shouldBypassInternalHrefNormalization(href)) {
    return href;
  }

  const url = new URL(href, URL_BASE);
  const segments = url.pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && hasLocale(routing.locales, firstSegment)) {
    const localizedPath = segments.slice(1).join("/");
    url.pathname = localizedPath ? `/${localizedPath}` : "/";
  }

  if (!url.pathname.startsWith("/")) {
    url.pathname = `/${url.pathname}`;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
