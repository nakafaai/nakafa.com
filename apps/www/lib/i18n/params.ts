import {
  APP_LOCALE_CODES,
  type AppLocaleCode,
} from "@nakafa/aksara-contracts/locale";
import {
  type PublicAppLocale,
  routing,
} from "@repo/internationalization/src/routing";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { hasPreviewConfig } from "@/lib/content/preview/config";

/** Narrows one route locale to the product's current public locale set. */
export function getActiveLocaleOrThrow(locale: string): PublicAppLocale {
  if (hasLocale(routing.locales, locale)) {
    return locale;
  }

  notFound();
}

/**
 * Narrows one route locale segment to the configured application locale union.
 *
 * Route helpers expose locale params as plain strings. This helper centralizes
 * the runtime guard so pages and layouts can use `PageProps` / `LayoutProps`
 * without re-declaring locale-specific param types.
 */
export function getLocaleOrThrow(locale: string): AppLocaleCode {
  if (hasLocale(routing.locales, locale)) {
    return locale;
  }

  if (hasPreviewConfig() && hasLocale(APP_LOCALE_CODES, locale)) {
    return locale;
  }

  notFound();
}
