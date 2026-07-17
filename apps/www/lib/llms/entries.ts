import type { api } from "@repo/backend/convex/_generated/api";
import {
  getPublicContentRouteCheck,
  type PublicContentRouteCheck,
} from "@repo/contents/_lib/public-route";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import type { Locale } from "next-intl";
import {
  getRuntimeContentRouteArtifactPage,
  getRuntimeContentRouteParentPage,
} from "@/lib/content/runtime/routes";
import {
  BASE_URL,
  type LlmsSection,
  SECTION_LABELS,
} from "@/lib/llms/constants";
import { formatRouteTitle } from "@/lib/llms/format";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";

const LLMS_LISTING_ENTRY_LIMIT = 100;
const sourceBackedSiteRoutes = [
  "/curricula",
  "/privacy-policy",
  "/security-policy",
  "/terms-of-service",
] as const;
type RuntimeContentRoute = NonNullable<
  FunctionReturnType<
    typeof api.contents.queries.runtime.getContentRouteArtifactPage
  >
>["routes"][number];
type ParentListingRowsArgs = Omit<
  Parameters<typeof getRuntimeContentRouteParentPage>[0],
  "cursor" | "limit"
>;

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

/**
 * Builds entries for one materialized route-catalog page without global reads.
 * Returns null when the requested artifact page has not been materialized.
 */
export const getContentPageLlmsEntries = Effect.fn(
  "www.llms.contentPageEntries"
)(function* ({
  locale,
  page,
  section,
}: {
  locale: Locale;
  page: number;
  section: Exclude<LlmsSection, "site">;
}) {
  const artifactPage = yield* getRuntimeContentRouteArtifactPage({
    locale,
    page,
    section,
  });

  if (!artifactPage) {
    return null;
  }

  return buildLocalizedLlmsEntriesFromRows({
    locale,
    rows: artifactPage.routes,
    section,
  });
});

/**
 * Builds entries for one public content listing route from route-catalog rows.
 *
 * Unsupported route shapes return null instead of fabricated entries. Supported
 * shapes read one bounded catalog page and reuse the same entry formatter as
 * normal llms indexes, so listing pages advertise only source-backed routes.
 */
export const getContentListingLlmsEntries = Effect.fn(
  "www.llms.contentListingEntries"
)(function* ({ locale, route }: { locale: Locale; route: string }) {
  const cleanRoute = route.replace(/^\/+|\/+$/g, "");
  const routeCheck = getPublicContentRouteCheck(cleanRoute);
  const rows = yield* readContentListingRows({ locale, routeCheck });

  if (rows === null) {
    return null;
  }

  return buildLocalizedLlmsEntriesFromRows({
    locale,
    rows,
    section: "articles",
  });
});

/** Builds locale-specific llms entries directly from materialized route rows. */
function buildLocalizedLlmsEntriesFromRows({
  locale,
  rows,
  section,
}: {
  locale: Locale;
  rows: readonly RuntimeContentRoute[];
  section: Exclude<LlmsSection, "site">;
}) {
  const entries: ReturnType<typeof buildLocalizedLlmsEntryFromRow>[] = [];

  for (const row of rows) {
    if (!row.markdown) {
      continue;
    }

    const entry = buildLocalizedLlmsEntryFromRow({ locale, row, section });

    entries.push(entry);
  }

  return entries.sort((a, b) => a.route.localeCompare(b.route));
}

/** Formats one route-catalog row without re-reading metadata by route. */
function buildLocalizedLlmsEntryFromRow({
  locale,
  row,
  section,
}: {
  locale: Locale;
  row: RuntimeContentRoute;
  section: Exclude<LlmsSection, "site">;
}) {
  const route = routeToPath(row.route);
  const publicRoute =
    getLocalizedMappedRoutePathname({ locale, route }) ?? route;
  const hrefBase = `${BASE_URL}/${locale}${publicRoute}`;
  const routeSegments = publicRoute.slice(1).split("/").filter(Boolean);

  return {
    description: row.description,
    href: `${hrefBase}.md`,
    route: publicRoute,
    section,
    segments: routeSegments,
    title: row.title,
  };
}

/** Converts one route string into an app-level HTTP path string. */
function routeToPath(route: string) {
  return `/${route}`;
}

/**
 * Reads one bounded route-catalog page for supported listing route shapes.
 *
 * The resolver returns null when the route is not a listing. Every supported
 * branch delegates to an indexed kind or parent page read with a fixed limit.
 */
function readContentListingRows({
  locale,
  routeCheck,
}: {
  locale: Locale;
  routeCheck: PublicContentRouteCheck;
}) {
  if (routeCheck.mode === "article-category") {
    return readParentListingRows({
      kind: "article",
      locale,
      order: "date-desc",
      parentRoute: routeCheck.parentRoute,
      section: "articles",
    });
  }

  return Effect.succeed(null);
}

/**
 * Reads one parent-scoped route page for a listing markdown document.
 *
 * Callers provide the already-classified parent route, and the helper enforces
 * the shared listing limit so listing indexes do not drift into full-table
 * collection.
 */
function readParentListingRows(args: ParentListingRowsArgs) {
  return getRuntimeContentRouteParentPage({
    ...args,
    cursor: null,
    limit: LLMS_LISTING_ENTRY_LIMIT,
  }).pipe(Effect.map((page) => page.page));
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
