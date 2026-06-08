import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { Feed, type Item } from "feed";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import {
  fetchRuntimeQuranSurahs,
  listRuntimeLatestContentRoutes,
} from "@/lib/content/runtime";
import { getQuranSurahName } from "@/lib/utils/pages/quran";

const baseUrl = "https://nakafa.com";
const RSS_CONTENT_ROUTE_LIMIT = 100;

/** Serves the RSS feed from Convex content routes and Quran runtime rows. */
export async function GET() {
  const locales = routing.locales;

  const [t, tCommon] = await Promise.all([
    getTranslations({
      namespace: "Metadata",
      locale: routing.defaultLocale,
    }),
    getTranslations({
      namespace: "Common",
      locale: routing.defaultLocale,
    }),
  ]);

  const [routes, surahs] = await Promise.all([
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
      const translation =
        surah.name.translation[locale] || surah.name.translation.en;

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

  return new NextResponse(feed.rss2());
}

/** Reads article and subject feed routes from the Convex route catalog. */
function getFeedContentRoutes() {
  return Effect.runPromise(
    Effect.gen(function* () {
      const routes = yield* Effect.forEach(
        routing.locales,
        (locale) =>
          Effect.all([
            listRuntimeLatestContentRoutes({
              limit: RSS_CONTENT_ROUTE_LIMIT,
              locale,
              section: "articles",
            }),
            listRuntimeLatestContentRoutes({
              limit: RSS_CONTENT_ROUTE_LIMIT,
              locale,
              section: "subject",
            }),
          ]),
        { concurrency: routing.locales.length }
      );

      return routes
        .flat(2)
        .sort((left, right) => (right.date ?? 0) - (left.date ?? 0))
        .slice(0, RSS_CONTENT_ROUTE_LIMIT);
    })
  );
}
