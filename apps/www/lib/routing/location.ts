import { MATERIAL_CONTEXT_QUERY_PARAM } from "@repo/contents/route/material/context";
import { splitLocalePathname } from "@repo/internationalization/src/href";
import { routing } from "@repo/internationalization/src/routing";
import { Array as Arr } from "effect";

/**
 * Get current locale from the URL pathname
 * Assumes locale is the first segment of the pathname, such as /en, /id, or /de.
 */
export function getLocale() {
  const { locale } = splitLocalePathname(
    window.location.pathname,
    routing.locales
  );

  // Fallback to default locale when the path starts with no configured locale
  return locale ?? routing.defaultLocale;
}

/**
 * Get current pathname without the locale prefix
 * This matches what usePathname() from next-intl returns
 */
export function getPathname() {
  const pathname = window.location.pathname;
  const { locale, publicSegments } = splitLocalePathname(
    pathname,
    routing.locales
  );

  // Remove the first segment (locale) and reconstruct the path
  if (locale) {
    const pathWithoutLocale = Arr.join(publicSegments, "/");
    return pathWithoutLocale ? `/${pathWithoutLocale}` : "/";
  }

  // If no locale in path, return the full pathname
  return pathname || "/";
}

/** Reads the raw material context hint for server-side Nina validation. */
export function getMaterialContextHint() {
  return (
    new URLSearchParams(window.location.search).get(
      MATERIAL_CONTEXT_QUERY_PARAM
    ) ?? undefined
  );
}
