import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { Feed, type Item } from "feed";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { readPublishedLatestArticles } from "@/lib/content/article/discovery";
import { readPublishedLatestMaterials } from "@/lib/content/material/discovery";
import {
  decodeMaterialReleasePin,
  type MaterialReleasePin,
} from "@/lib/content/material/release";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { fetchRuntimeQuranSurahs } from "@/lib/content/runtime/pages";
import { getQuranSurahName } from "@/lib/utils/pages/quran";

const baseUrl = "https://nakafa.com";
const RSS_CONTENT_ROUTE_LIMIT = 100;
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
    (left, right) => right.date.getTime() - left.date.getTime()
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
      const active = yield* readActiveContentIdentity();
      if (!active) {
        return yield* new PublishedProjectionError({
          locale: routing.defaultLocale,
          publicPath: "rss.xml",
        });
      }
      const activeReleaseId = active.releaseId;
      const routes = yield* Effect.forEach(
        routing.locales,
        (locale) =>
          Effect.all([
            readFeedArticles(locale),
            readFeedMaterials(locale, activeReleaseId),
          ]),
        { concurrency: routing.locales.length }
      );
      const latest = yield* readActiveContentIdentity();
      yield* decodeMaterialReleasePin(
        latest?.releaseId ?? null,
        activeReleaseId,
        { locale: routing.defaultLocale, publicPath: "rss.xml" }
      );

      return routes
        .flat(2)
        .sort((left, right) => right.date - left.date)
        .slice(0, RSS_CONTENT_ROUTE_LIMIT);
    })
  );
}

/** Selects signed published articles. */
const readFeedArticles = Effect.fn("www.rss.readArticles")(function* (
  locale: (typeof routing.locales)[number]
) {
  const published = yield* readPublishedLatestArticles(
    locale,
    RSS_CONTENT_ROUTE_LIMIT
  );
  return published.articles.map((article) => ({
    authors: article.authors,
    date: Date.parse(`${article.date}T00:00:00.000Z`),
    description: article.description,
    locale,
    route: article.publicPath,
    title: article.title,
  }));
});

/** Selects signed published materials. */
const readFeedMaterials = Effect.fn("www.rss.readMaterials")(function* (
  locale: (typeof routing.locales)[number],
  expectedActiveReleaseId: MaterialReleasePin
) {
  const published = yield* readPublishedLatestMaterials(
    locale,
    RSS_CONTENT_ROUTE_LIMIT
  );
  yield* decodeMaterialReleasePin(
    published.activeReleaseId,
    expectedActiveReleaseId,
    { locale, publicPath: "rss.xml" }
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
  return publishedRoutes;
});
