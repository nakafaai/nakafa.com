import type { Locale } from "next-intl";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import { formatRouteTitle } from "@/lib/llms/format";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";

const sourceBackedSiteRoutes = [
  "/curricula",
  "/privacy-policy",
  "/security-policy",
  "/terms-of-service",
] as const;

/** One localized link advertised by a Nakafa llms index. */
export interface LlmsEntry {
  description: string | undefined;
  href: string;
  route: string;
  section: LlmsSection;
  segments: string[];
  title: string;
}

/** Checks whether a route segment is a supported llms section. */
export function isLlmsSection(
  section: string | undefined
): section is LlmsSection {
  return typeof section === "string" && Object.hasOwn(SECTION_LABELS, section);
}

/** Returns the configured llms sections in display order. */
export function getLlmsSections() {
  return Object.keys(SECTION_LABELS).filter(isLlmsSection);
}

/** Builds site-page entries without reading the content route catalog. */
export function getSiteLlmsEntries(locale: Locale) {
  const entries: LlmsEntry[] = [];

  for (const route of sourceBackedSiteRoutes) {
    entries.push(buildLocalizedSiteLlmsEntry({ locale, route }));
  }

  return entries;
}

/** Builds one locale-specific llms entry from a sitemap route. */
function buildLocalizedSiteLlmsEntry({
  locale,
  route,
}: {
  locale: Locale;
  route: string;
}) {
  const publicRoute =
    getLocalizedMappedRoutePathname({ locale, route }) ?? route;
  const hrefBase = `${BASE_URL}/${locale}${publicRoute}`;
  const routePath = publicRoute.slice(1);
  const routeSegments = ["site", ...routePath.split("/").filter(Boolean)];
  const section: LlmsSection = "site";

  return {
    description: undefined,
    href: hrefBase,
    route: publicRoute,
    section,
    segments: routeSegments,
    title: formatRouteTitle(publicRoute),
  };
}
