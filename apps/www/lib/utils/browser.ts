import { routing } from "@repo/internationalization/src/routing";
import { hasLocale } from "next-intl";

/**
 * Get current locale from the URL pathname
 * Assumes locale is the first segment of the pathname (e.g., /en/... or /id/...)
 */
export function getLocale() {
  const pathname = window.location.pathname;
  const segments = pathname.split("/").filter(Boolean);

  // Get the first segment which should be the locale
  const locale = segments[0];

  // Validate if it's a valid locale using next-intl's hasLocale
  if (locale && hasLocale(routing.locales, locale)) {
    return locale;
  }

  // Fallback to default locale
  return routing.defaultLocale;
}

/**
 * Get current pathname without the locale prefix
 * This matches what usePathname() from next-intl returns
 */
export function getPathname() {
  const pathname = window.location.pathname;
  const segments = pathname.split("/").filter(Boolean);

  // Remove the first segment (locale) and reconstruct the path
  const localeSegment = segments[0];
  if (localeSegment && hasLocale(routing.locales, localeSegment)) {
    const pathWithoutLocale = segments.slice(1).join("/");
    return pathWithoutLocale ? `/${pathWithoutLocale}` : "/";
  }

  // If no locale in path, return the full pathname
  return pathname || "/";
}
