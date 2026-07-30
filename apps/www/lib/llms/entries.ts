import type { Locale } from "next-intl";
import type { RuntimeContentRoute } from "@/lib/content/runtime/routes";
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
];

/** One localized link advertised by a Nakafa llms index. */
export interface LlmsEntry {
  description: string | undefined;
  href: string;
  route: string;
  section: LlmsSection;
  segments: string[];
  title: string;
}

interface PublishedContentSummary {
  readonly description: string | undefined;
  readonly publicPath: string;
  readonly title: string;
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

/** Builds sorted agent entries from compact published content summaries. */
export function buildPublishedContentLlmsEntries({
  locale,
  rows,
  section,
}: {
  locale: Locale;
  rows: readonly PublishedContentSummary[];
  section: Exclude<LlmsSection, "site">;
}) {
  return rows
    .map((row) => {
      const route = `/${row.publicPath}`;
      return {
        description: row.description,
        href: `${BASE_URL}/${locale}${route}.md`,
        route,
        section,
        segments: row.publicPath.split("/"),
        title: row.title,
      };
    })
    .sort((left, right) => left.route.localeCompare(right.route));
}

/** Builds sorted locale-specific agent entries from verified route rows. */
export function buildRuntimeContentLlmsEntries({
  locale,
  rows,
  section,
}: {
  locale: Locale;
  rows: readonly RuntimeContentRoute[];
  section: Exclude<LlmsSection, "site">;
}) {
  const entries: LlmsEntry[] = [];

  for (const row of rows) {
    if (!row.markdown) {
      continue;
    }

    entries.push(buildRuntimeContentLlmsEntry({ locale, row, section }));
  }

  return entries.sort((left, right) => left.route.localeCompare(right.route));
}

/** Formats one verified route row without re-reading content metadata. */
function buildRuntimeContentLlmsEntry({
  locale,
  row,
  section,
}: {
  locale: Locale;
  row: RuntimeContentRoute;
  section: Exclude<LlmsSection, "site">;
}): LlmsEntry {
  const route = `/${row.route}`;
  const publicRoute =
    getLocalizedMappedRoutePathname({ locale, route }) ?? route;
  const hrefBase = `${BASE_URL}/${locale}${publicRoute}`;

  return {
    description: row.description,
    href: `${hrefBase}.md`,
    route: publicRoute,
    section,
    segments: publicRoute.slice(1).split("/").filter(Boolean),
    title: row.title,
  };
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
