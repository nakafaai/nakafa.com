import type { PublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import { Option } from "effect";
import type { Locale } from "next-intl";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import { formatRouteTitle } from "@/lib/llms/format";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";

const derivedSiteRoutes = ["/curricula"] as const;
type DerivedSiteRoute = (typeof derivedSiteRoutes)[number];

/** One localized link advertised by a Nakafa llms index. */
export interface LlmsEntry {
  description?: string;
  href: string;
  route: string;
  section: LlmsSection;
  segments: string[];
  title: string;
}

interface PublishedContentSummary {
  readonly description?: string;
  readonly publicPath: string;
  readonly title: string;
}

export interface ApplicationSiteSummary {
  readonly description: string;
  readonly route: string;
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

/** Builds site entries from derived indexes and signed Page projections. */
export function buildSiteLlmsEntries(
  locale: Locale,
  pages: readonly PublicPageProjection[],
  applicationPages: readonly ApplicationSiteSummary[]
) {
  const entries: LlmsEntry[] = derivedSiteRoutes.flatMap((route) =>
    Option.toArray(buildLocalizedSiteLlmsEntry({ locale, route }))
  );

  entries.push(
    ...applicationPages.map((page) =>
      buildSiteLlmsEntry({
        description: page.description,
        locale,
        publicRoute: page.route,
        title: page.title,
      })
    )
  );

  for (const page of pages) {
    if (page.appLocale !== locale) {
      continue;
    }
    const route = `/${page.publicPath}`;
    entries.push({
      description: page.metadata.description,
      href: `${BASE_URL}/${locale}${route}`,
      route,
      section: "site",
      segments: ["site", ...page.publicPath.split("/")],
      title: page.metadata.title,
    });
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
        ...(row.description === undefined
          ? {}
          : { description: row.description }),
        href: `${BASE_URL}/${locale}${route}.md`,
        route,
        section,
        segments: row.publicPath.split("/"),
        title: row.title,
      };
    })
    .sort((left, right) => left.route.localeCompare(right.route));
}

/** Builds one locale-specific llms entry from a sitemap route. */
function buildLocalizedSiteLlmsEntry({
  locale,
  route,
}: {
  locale: Locale;
  route: DerivedSiteRoute;
}) {
  return Option.map(
    getLocalizedMappedRoutePathname({ locale, route }),
    (publicRoute) =>
      buildSiteLlmsEntry({
        locale,
        publicRoute,
        title: formatRouteTitle(publicRoute),
      })
  );
}

/** Builds one localized site entry from its owned route and metadata. */
function buildSiteLlmsEntry({
  description,
  locale,
  publicRoute,
  title,
}: {
  description?: string;
  locale: Locale;
  publicRoute: string;
  title: string;
}) {
  const hrefBase = `${BASE_URL}/${locale}${publicRoute}`;
  const routePath = publicRoute.slice(1);
  const routeSegments = ["site", ...routePath.split("/").filter(Boolean)];
  const section: LlmsSection = "site";

  return {
    ...(description === undefined ? {} : { description }),
    href: hrefBase,
    route: publicRoute,
    section,
    segments: routeSegments,
    title,
  };
}
