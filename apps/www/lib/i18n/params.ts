import { routing } from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { hasLocale } from "next-intl";

/**
 * Narrows one route locale segment to the configured application locale union.
 *
 * Route helpers expose locale params as plain strings. This helper centralizes
 * the runtime guard so pages and layouts can use `PageProps` / `LayoutProps`
 * without re-declaring locale-specific param types.
 */
export function getLocaleOrThrow(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return locale;
}
