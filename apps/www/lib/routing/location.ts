import {
  MATERIAL_CONTEXT_HINT_LENGTH,
  MATERIAL_CONTEXT_QUERY_PARAM,
} from "@repo/contents/route/material/context";
import { splitLocalePathname } from "@repo/internationalization/src/href";
import { DEFAULT_LOCALE, LOCALES } from "@repo/internationalization/src/locale";
import { Array as Arr } from "effect";

/**
 * Get current locale from the URL pathname
 * Assumes locale is the first segment of the pathname, such as /en, /id, or /de.
 */
export function getLocale() {
  const { locale } = splitLocalePathname(window.location.pathname, LOCALES);

  // Fallback to default locale when the path starts with no configured locale
  return locale ?? DEFAULT_LOCALE;
}

/**
 * Get current pathname without the locale prefix
 * This matches what usePathname() from the locale seam returns
 */
export function getPathname() {
  const pathname = window.location.pathname;
  const { locale, publicSegments } = splitLocalePathname(pathname, LOCALES);

  // Remove the first segment (locale) and reconstruct the path
  if (locale) {
    const pathWithoutLocale = Arr.join(publicSegments, "/");
    return pathWithoutLocale ? `/${pathWithoutLocale}` : "/";
  }

  // If no locale in path, return the full pathname
  return pathname || "/";
}

/**
 * Reads the raw material context hint for server-side Nina validation. A hint
 * longer than the server accepts is left out, as the material page leaves it
 * out.
 */
export function getMaterialContextHint() {
  const hint = new URLSearchParams(window.location.search).get(
    MATERIAL_CONTEXT_QUERY_PARAM
  );
  return hint !== null && hint.length <= MATERIAL_CONTEXT_HINT_LENGTH
    ? hint
    : undefined;
}
