import type { Article, Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect } from "effect";

import { getRuntimeContentRouteParentPage } from "@/lib/content/runtime/routes";

const articleSummaryPageLimit = 100;
const trailingSlashPattern = /\/$/;

/** Reads article card summaries from Convex route catalog rows. */
export const getRuntimeArticleSummaries = Effect.fn(
  "www.contentArticles.summaries"
)(function* (category: string, locale: Locale) {
  const rows = yield* readArticleRouteParentPage(category, locale);
  const articles = new Map<string, Article>();

  for (const row of rows) {
    const slug = getDirectChildSegment(row.route, `articles/${category}/`);

    if (!(slug && row.date) || articles.has(slug)) {
      continue;
    }

    articles.set(slug, {
      date: new Date(row.date).toISOString(),
      description: row.description ?? "",
      official: row.official ?? false,
      slug,
      title: row.title,
    });
  }

  return Array.from(articles.values()).sort((a, b) =>
    b.date.localeCompare(a.date)
  );
});

/**
 * Reads one category page from the runtime route catalog so article listings
 * follow the same parent-route ordering as sitemap and search.
 */
function readArticleRouteParentPage(category: string, locale: Locale) {
  return getRuntimeContentRouteParentPage({
    cursor: null,
    kind: "article",
    limit: articleSummaryPageLimit,
    locale,
    order: "date-desc",
    parentRoute: `articles/${category}`,
    section: "articles",
  }).pipe(Effect.map((page) => page.page));
}

/**
 * Extracts the immediate child segment under a category route; deeper article
 * slugs are intentionally collapsed to their first visible grouping segment.
 */
function getDirectChildSegment(route: string, prefix: string) {
  const [segment] = getRelativeRouteParts(
    route,
    prefix.replace(trailingSlashPattern, "")
  );
  return segment;
}

/**
 * Returns route segments below one normalized parent path, or an empty list
 * when the runtime row is outside that parent.
 */
function getRelativeRouteParts(route: string, basePath: string) {
  const normalizedRoute = cleanContentPath(route);
  const normalizedBase = cleanContentPath(basePath);

  if (!normalizedRoute.startsWith(`${normalizedBase}/`)) {
    return [];
  }

  return normalizedRoute.slice(normalizedBase.length + 1).split("/");
}

function cleanContentPath(path: string) {
  return cleanSlug(path.startsWith("/") ? path.slice(1) : path);
}
