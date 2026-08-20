import { previewRouting } from "@repo/internationalization/src/routing";
import { hasLocale } from "next-intl";

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
  const segments = url.pathname.split("/").filter(Boolean);
  const firstSegment = segments[0];

  if (firstSegment && hasLocale(previewRouting.locales, firstSegment)) {
    const localizedPath = segments.slice(1).join("/");
    url.pathname = localizedPath ? `/${localizedPath}` : "/";
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
