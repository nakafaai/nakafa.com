import { cleanSlug } from "@repo/utilities/helper";
import type { Locale } from "next-intl";

/**
 * Get the Open Graph URL for a given locale and path.
 */
export function getOgUrl(locale: Locale, path: string) {
  const cleanPath = cleanSlug(path.trim());

  if (cleanPath.length === 0) {
    return `/${locale}/og/image.png` as const;
  }

  return `/${locale}/og/${cleanPath}/image.png` as const;
}
