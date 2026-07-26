import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import type { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import type { PublishedArticleSummary } from "@/lib/content/article/catalog";
import {
  readPublishedArticleBucket,
  readPublishedCategoryArticles,
} from "@/lib/content/article/discovery";
import { readPublishedArticleBuckets } from "@/lib/content/article/sitemap";
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
  if (section === "articles") {
    const published = yield* readPublishedArticleBuckets(locale);
    if (published.managed) {
      const bucket = published.buckets[page];
      if (!bucket) {
        return null;
      }
      const partition = yield* readPublishedArticleBucket(locale, bucket);
      if (!(partition.managed && partition.articles)) {
        return null;
      }
      return buildPublishedArticleEntries({
        articles: partition.articles,
        locale,
      });
    }
  }

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
 * normal llms indexes, so listing pages advertise only verified routes.
 */
export const getContentListingLlmsEntries = Effect.fn(
  "www.llms.contentListingEntries"
)(function* ({ locale, route }: { locale: Locale; route: string }) {
  const cleanRoute = route.replace(/^\/+|\/+$/g, "");
  const category = readArticleListingCategory(cleanRoute);
  if (!category) {
    return null;
  }

  const published = yield* readPublishedCategoryArticles(
    locale,
    category,
    LLMS_LISTING_ENTRY_LIMIT
  );
  if (published.managed) {
    return buildPublishedArticleEntries({
      articles: published.articles,
      locale,
    });
  }
  const rows = yield* readParentListingRows({
    kind: "article",
    locale,
    order: "date-desc",
    parentRoute: cleanRoute,
    section: "articles",
  });
  return buildLocalizedLlmsEntriesFromRows({
    locale,
    rows,
    section: "articles",
  });
});

/** Parses one exact article listing through the current Aksara contract. */
function readArticleListingCategory(route: string) {
  const [root, category, ...remaining] = route.split("/").filter(Boolean);
  if (
    root !== "articles" ||
    remaining.length > 0 ||
    !Schema.is(ArticleCategorySchema)(category)
  ) {
    return null;
  }

  return category;
}

/** Builds agent-facing entries from compact verified article summaries. */
function buildPublishedArticleEntries({
  articles,
  locale,
}: {
  articles: readonly PublishedArticleSummary[];
  locale: Locale;
}) {
  return articles
    .map((article) => {
      const route = `/${article.publicPath}`;
      return {
        description: article.description,
        href: `${BASE_URL}/${locale}${route}.md`,
        route,
        section: "articles" as const,
        segments: article.publicPath.split("/"),
        title: article.title,
      };
    })
    .sort((left, right) => left.route.localeCompare(right.route));
}

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
