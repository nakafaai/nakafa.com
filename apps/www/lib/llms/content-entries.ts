import { ArticleCategorySchema } from "@nakafa/aksara-contracts/projection/article";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import type { PublishedArticleSummary } from "@/lib/content/article/catalog";
import {
  readPublishedArticleBucket,
  readPublishedCategoryArticles,
} from "@/lib/content/article/discovery";
import { readPublishedArticleBuckets } from "@/lib/content/article/sitemap";
import {
  type PublishedMaterialSummary,
  readPublishedMaterialBucket,
} from "@/lib/content/material/discovery";
import { readPublishedMaterialBuckets } from "@/lib/content/material/sitemap";
import type { RuntimeContentRoute } from "@/lib/content/runtime/routes";
import {
  getRuntimeContentRouteArtifactPage,
  getRuntimeContentRouteParentPage,
} from "@/lib/content/runtime/routes";
import { BASE_URL, type LlmsSection } from "@/lib/llms/constants";
import type { LlmsEntry } from "@/lib/llms/entries";
import { reconcileMaterialLlmsRows } from "@/lib/llms/material";
import { getLocalizedMappedRoutePathname } from "@/lib/routing/public/pathnames";

const LLMS_LISTING_ENTRY_LIMIT = 100;
type ParentListingRowsArgs = Omit<
  Parameters<typeof getRuntimeContentRouteParentPage>[0],
  "cursor" | "limit"
>;

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

  if (section === "material") {
    const published = yield* readPublishedMaterialBuckets(locale);
    if (published.managed) {
      const bucket = published.buckets[page];
      if (!bucket) {
        return null;
      }
      const partition = yield* readPublishedMaterialBucket(locale, bucket);
      if (!(partition.managed && partition.materials)) {
        return null;
      }
      return buildPublishedMaterialEntries({
        locale,
        materials: partition.materials,
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
  if (section === "material") {
    const sources = yield* reconcileMaterialLlmsRows(
      locale,
      artifactPage.routes
    );
    return [
      ...buildPublishedMaterialEntries({
        locale,
        materials: sources.projections.map((projection) => ({
          description: projection.metadata.description,
          publicPath: projection.publicPath,
          title: projection.metadata.title,
        })),
      }),
      ...buildLocalizedLlmsEntriesFromRows({
        locale,
        rows: sources.rows,
        section,
      }),
    ].sort((left, right) => left.route.localeCompare(right.route));
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

/** Builds agent-facing entries from compact verified material summaries. */
function buildPublishedMaterialEntries({
  locale,
  materials,
}: {
  locale: Locale;
  materials: readonly Pick<
    PublishedMaterialSummary,
    "description" | "publicPath" | "title"
  >[];
}) {
  return materials
    .map((material) => {
      const route = `/${material.publicPath}`;
      return {
        description: material.description,
        href: `${BASE_URL}/${locale}${route}.md`,
        route,
        section: "material" as const,
        segments: material.publicPath.split("/"),
        title: material.title,
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
  const entries: LlmsEntry[] = [];

  for (const row of rows) {
    if (!row.markdown) {
      continue;
    }

    entries.push(buildLocalizedLlmsEntryFromRow({ locale, row, section }));
  }

  return entries.sort((left, right) => left.route.localeCompare(right.route));
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
