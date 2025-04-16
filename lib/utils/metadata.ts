import type { Locale } from "next-intl";
import { removeLeadingSlash } from ".";

/**
 * Get the Open Graph URL for a given locale and path
 * @param locale - The locale of the page
 * @param path - The path of the page
 * @returns The Open Graph URL
 */
export function getOgUrl(locale: Locale, path: string) {
  return [`/${locale}/og`, removeLeadingSlash(path), "image.png"].join("/");
}
