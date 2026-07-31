import { EXACT_SCOPE_LIMIT } from "@repo/backend/convex/contentRelease/spec";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { Feed, type Item } from "feed";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { readPublishedLatestArticles } from "@/lib/content/article/discovery";
import { readPublishedLatestMaterials } from "@/lib/content/material/discovery";
import { fetchRuntimeQuranSurahs } from "@/lib/content/runtime/pages";
import {
  getRuntimeLatestContentRoutePage,
  type RuntimeLatestContentRoute,
  type RuntimeLatestContentRoutePage,
} from "@/lib/content/runtime/routes";
import { getQuranSurahName } from "@/lib/utils/pages/quran";

const baseUrl = "https://nakafa.com";
const RSS_CONTENT_ROUTE_LIMIT = 100;
const RSS_SOURCE_PAGE_SIZE = 100;
const rssHeaders = {
  "Content-Type": "application/rss+xml; charset=utf-8",
};

/** Serves the RSS feed from Convex content routes and Quran runtime rows. */
export async function GET() {
  const locales = routing.locales;

  const [t, tCommon, routes, surahs] = await Promise.all([
    getTranslations({
      namespace: "Metadata",
      locale: routing.defaultLocale,
    }),
    getTranslations({
      namespace: "Common",
      locale: routing.defaultLocale,
    }),
    getFeedContentRoutes(),
    fetchRuntimeQuranSurahs(),
  ]);

  const feed = new Feed({
    title: t("title"),
    description: t("description"),
    id: `${baseUrl}`,
    link: `${baseUrl}`,
    language: routing.defaultLocale,
    image: `${baseUrl}/og.png`,
    favicon: `${baseUrl}/icon.png`,
    copyright: tCommon("copyright", { year: new Date().getFullYear() }),
  });

  // Collect all feed items
  const feedItems: Item[] = [];

  for (const route of routes) {
    if (!route.date) {
      continue;
    }

    const link = `${baseUrl}/${route.locale}/${route.route}`;
    feedItems.push({
      title: route.title,
      description: route.description ?? route.title,
      link,
      date: new Date(route.date),
      id: link,
      author: route.authors,
      image: `${baseUrl}/${route.locale}/og/${route.route}/image.png`,
    });
  }

  // Add Quran surahs to feed
  for (const locale of locales) {
    for (const surah of surahs) {
      const title = getQuranSurahName({ locale, name: surah.name });
      const translation = surah.name.translation[locale];

      feedItems.push({
        title: `${surah.number}. ${title}`,
        description: translation,
        link: `${baseUrl}/${locale}/quran/${surah.number}`,
        date: new Date("2025-01-01"), // Static date for Quran content
        id: `/${locale}/quran/${surah.number}`,
        image: `${baseUrl}/og.png`, // Default OG image for Quran
      });
    }
  }

  // Sort by date (newest first) and add to feed
  const sortedItems = feedItems.sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
  for (const item of sortedItems) {
    feed.addItem(item);
  }

  return new NextResponse(feed.rss2(), { headers: rssHeaders });
}

/** Reads article and subject feed routes from the Convex route catalog. */
function getFeedContentRoutes() {
  return Effect.runPromise(
    Effect.gen(function* () {
      const routes = yield* Effect.forEach(
        routing.locales,
        (locale) =>
          Effect.all([readFeedArticles(locale), readFeedMaterials(locale)]),
        { concurrency: routing.locales.length }
      );

      return routes
        .flat(2)
        .sort((left, right) => (right.date ?? 0) - (left.date ?? 0))
        .slice(0, RSS_CONTENT_ROUTE_LIMIT);
    })
  );
}

/** Selects published articles after cutover and source-backed rows before it. */
const readFeedArticles = Effect.fn("www.rss.readArticles")(function* (
  locale: (typeof routing.locales)[number]
) {
  const published = yield* readPublishedLatestArticles(
    locale,
    RSS_CONTENT_ROUTE_LIMIT
  );
  if (!published.managed) {
    return yield* readFeedSourceRoutes(locale, "articles", new Set(), 100);
  }

  return published.articles.map((article) => ({
    authors: article.authors,
    date: Date.parse(`${article.date}T00:00:00.000Z`),
    description: article.description,
    locale,
    route: article.publicPath,
    title: article.title,
  }));
});

/** Selects published materials after cutover and source rows before it. */
const readFeedMaterials = Effect.fn("www.rss.readMaterials")(function* (
  locale: (typeof routing.locales)[number]
) {
  const published = yield* readPublishedLatestMaterials(
    locale,
    RSS_CONTENT_ROUTE_LIMIT
  );
  const publishedRoutes = published.materials.map((material) => ({
    authors: material.authors,
    date: Date.parse(`${material.date}T00:00:00.000Z`),
    description: material.description,
    locale,
    route: material.publicPath,
    sourcePath: material.sourcePath,
    title: material.title,
  }));
  if (published.managed) {
    return publishedRoutes;
  }
  const claimedContentKeys = new Set<string>(published.claimedContentKeys);
  const sourceRoutes = yield* readFeedSourceRoutes(
    locale,
    "material",
    claimedContentKeys,
    RSS_CONTENT_ROUTE_LIMIT
  );
  return [...publishedRoutes, ...sourceRoutes]
    .sort((left, right) => (right.date ?? 0) - (left.date ?? 0))
    .slice(0, RSS_CONTENT_ROUTE_LIMIT);
});

/** Refills one source-owned feed after exact owners remove legacy rows. */
const readFeedSourceRoutes = Effect.fn("www.rss.readSourceRoutes")(function* (
  locale: (typeof routing.locales)[number],
  section: "articles" | "material",
  excludedContentKeys: ReadonlySet<string>,
  limit: number
) {
  const sourceRowLimit =
    limit + Math.min(excludedContentKeys.size, EXACT_SCOPE_LIMIT);
  const routes: RuntimeLatestContentRoute[] = [];
  let cursor: string | null = null;
  let examinedRows = 0;
  for (
    let request = 0;
    request < sourceRowLimit && examinedRows < sourceRowLimit;
    request += 1
  ) {
    const pageLimit = Math.min(
      RSS_SOURCE_PAGE_SIZE,
      sourceRowLimit - examinedRows
    );
    const result: RuntimeLatestContentRoutePage =
      yield* getRuntimeLatestContentRoutePage({
        cursor,
        limit: pageLimit,
        locale,
        section,
      });
    examinedRows += result.page.length;
    for (const route of result.page) {
      if (excludedContentKeys.has(route.sourcePath)) {
        continue;
      }
      routes.push(route);
      if (routes.length === limit) {
        return routes;
      }
    }
    if (result.isDone) {
      return routes;
    }
    if (result.continueCursor === cursor) {
      return routes;
    }
    cursor = result.continueCursor;
  }
  return routes;
});
