import { getCanonicalNakafaContentUrl } from "@repo/ai/nina/runtime/page";
import type { Locale } from "@repo/contents/_types/content";
import { PUBLIC_ROUTE_SURFACES } from "@repo/contents/_types/route/surface";
import { cleanSlug } from "@repo/utilities/helper";

const verifiableContentNamespaces = new Set(["articles", "quran"]);
for (const surface of PUBLIC_ROUTE_SURFACES) {
  if (surface.key === "tryout") {
    continue;
  }
  for (const routeSlug of Object.values(surface.routeSlugs)) {
    verifiableContentNamespaces.add(routeSlug);
  }
}

/** Checks whether one public path can resolve to verified learning content. */
export function isVerifiableContentPath(slug: string) {
  const [namespace] = cleanSlug(slug).split("/");
  return namespace !== undefined && verifiableContentNamespaces.has(namespace);
}

/**
 * Builds the canonical public Nakafa URL for the current chat page projection.
 */
export function getCanonicalCurrentPageContentUrl({
  locale,
  slug,
}: {
  locale: Locale;
  slug: string;
}) {
  return getCanonicalNakafaContentUrl(`/${locale}/${cleanSlug(slug)}`);
}
