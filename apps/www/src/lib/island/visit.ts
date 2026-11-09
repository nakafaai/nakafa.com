import type { Locale } from "@repo/internationalization/src/locale";
import { SITE_ORIGIN } from "@repo/seo/origin";

/** The address where anyone with the link visits a learner's shared island (ADR 0042, D20). */
export function visitHref(locale: Locale, username: string) {
  return new URL(
    `/${locale}/island/${encodeURIComponent(username)}`,
    SITE_ORIGIN
  ).href;
}
