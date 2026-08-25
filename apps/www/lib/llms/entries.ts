import type { PublicPageProjection } from "@nakafa/aksara-contracts/projection/page";
import type { Locale } from "next-intl";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import { formatRouteTitle } from "@/lib/llms/format";

const derivedSiteRoutes = ["/contact"] as const;

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

/** Builds site entries from derived indexes and signed Page projections. */
export function buildSiteLlmsEntries(
  locale: Locale,
  pages: readonly PublicPageProjection[]
) {
  const entries: LlmsEntry[] = derivedSiteRoutes.map((route) => ({
    description: undefined,
    href: `${BASE_URL}/${locale}${route}`,
    route,
    section: "site",
    segments: ["site", ...route.split("/").filter(Boolean)],
    title: formatRouteTitle(route),
  }));

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
