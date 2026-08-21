import type { Locale } from "next-intl";
import { getOgUrl } from "@/lib/utils/metadata";

const REVIEWED_STATIC_ARTWORK_LOCALES = new Set<Locale>(["en", "id"]);

/** Checks whether one locale has a complete reviewed static artwork set. */
export function hasStaticArtwork(locale: Locale) {
  return REVIEWED_STATIC_ARTWORK_LOCALES.has(locale);
}

/** Uses reviewed static artwork or the localized dynamic OG renderer. */
export function resolveSocialArtwork({
  locale,
  publicPath,
  reviewedPath,
}: {
  readonly locale: Locale;
  readonly publicPath: string;
  readonly reviewedPath: string;
}) {
  if (hasStaticArtwork(locale)) {
    return reviewedPath;
  }

  return getOgUrl(locale, publicPath);
}
