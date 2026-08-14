import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { routing } from "@repo/internationalization/src/routing";
import { Effect } from "effect";
import { Feed, type Item } from "feed";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { readPublishedLatestArticles } from "@/lib/content/article/discovery";
import { readPublishedLatestMaterials } from "@/lib/content/material/discovery";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";

const baseUrl = "https://nakafa.com";
const RSS_CONTENT_ROUTE_LIMIT = 100;
const rssHeaders = {
  "Content-Type": "application/rss+xml; charset=utf-8",
};

/** Serves the RSS feed from dated signed article and material publications. */
export async function GET() {
  const [t, tCommon, routes] = await Promise.all([
    getTranslations({
      namespace: "Metadata",
      locale: routing.defaultLocale,
    }),
    getTranslations({
      namespace: "Common",
      locale: routing.defaultLocale,
    }),
    getFeedContentRoutes(),
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

  const feedItems: Item[] = [];

  for (const route of routes) {
    const link = `${baseUrl}/${route.appLocale}/${route.route}`;
    feedItems.push({
      title: route.title,
      description: route.description ?? route.title,
      link,
      date: new Date(route.date),
      id: link,
      author: route.authors,
      image: `${baseUrl}/${route.appLocale}/og/${route.route}/image.png`,
    });
  }

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
          appLocale: AppLocaleSchema.make(routing.defaultLocale),
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
      yield* decodeContentReleasePin(
        latest?.releaseId ?? null,
        activeReleaseId,
        {
          appLocale: AppLocaleSchema.make(routing.defaultLocale),
          publicPath: "rss.xml",
        }
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
  const appLocale = AppLocaleSchema.make(locale);
  const published = yield* readPublishedLatestArticles(
    locale,
    RSS_CONTENT_ROUTE_LIMIT
  );
  return published.articles.map((article) => ({
    authors: article.authors,
    appLocale,
    date: Date.parse(`${article.date}T00:00:00.000Z`),
    description: article.description,
    route: article.publicPath,
    title: article.title,
  }));
});

/** Selects signed published materials. */
const readFeedMaterials = Effect.fn("www.rss.readMaterials")(function* (
  locale: (typeof routing.locales)[number],
  expectedActiveReleaseId: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const published = yield* readPublishedLatestMaterials(
    locale,
    RSS_CONTENT_ROUTE_LIMIT
  );
  yield* decodeContentReleasePin(
    published.activeReleaseId,
    expectedActiveReleaseId,
    { appLocale, publicPath: "rss.xml" }
  );
  const publishedRoutes = published.materials.map((material) => ({
    authors: material.authors,
    date: Date.parse(`${material.date}T00:00:00.000Z`),
    description: material.description,
    appLocale,
    route: material.publicPath,
    sourcePath: material.sourcePath,
    title: material.title,
  }));
  return publishedRoutes;
});
