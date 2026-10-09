import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import { routing } from "@repo/internationalization/src/routing";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr, DateTime, Effect, Order } from "effect";
import { Feed, type Item } from "feed";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { readPublishedLatestArticles } from "@/lib/content/article/discovery";
import { applyContentCache } from "@/lib/content/cache";
import { readPublishedLatestMaterials } from "@/lib/content/material/discovery";
import { readActiveContentIdentity } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";

const baseUrl = COMPANY_IDENTITY.url;
const RSS_CONTENT_ROUTE_LIMIT = 100;
const rssHeaders = {
  "Content-Type": "application/rss+xml; charset=utf-8",
};

/** Serves the RSS feed from dated signed article and material publications. */
export async function GET() {
  return new NextResponse(await readFeed(), { headers: rssHeaders });
}

/** Prerenders the complete feed and refreshes it when either source changes. */
async function readFeed() {
  "use cache";

  applyContentCache("article", "material");
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
    updated: DateTime.toDateUtc(
      DateTime.makeUnsafe(
        Math.max(0, ...Arr.map(routes, (route) => route.dateModified))
      )
    ),
    title: t("title"),
    description: t("description"),
    id: `${baseUrl}`,
    link: `${baseUrl}`,
    language: routing.defaultLocale,
    image: `${baseUrl}/og.png`,
    favicon: `${baseUrl}/icon.png`,
    copyright: tCommon("copyright", {
      year: DateTime.toDate(DateTime.nowUnsafe()).getFullYear(),
      companyName: COMPANY_IDENTITY.legalName,
    }),
  });

  const feedItems: Item[] = Arr.map(routes, (route) => {
    const link = `${baseUrl}/${route.appLocale}/${route.route}`;
    return {
      title: route.title,
      description: route.description ?? route.title,
      link,
      date: DateTime.toDateUtc(DateTime.makeUnsafe(route.datePublished)),
      id: link,
      author: route.authors,
      image: `${baseUrl}/${route.appLocale}/og/${route.route}/image.png`,
    };
  });

  const sortedItems = Arr.sortWith(
    feedItems,
    (item) => item.date.getTime(),
    Order.flip(Order.Number)
  );
  for (const item of sortedItems) {
    feed.addItem(item);
  }

  return feed.rss2();
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
            readFeedArticles(locale, activeReleaseId),
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

      return Arr.sortWith(
        Arr.flatten(Arr.flatten(routes)),
        (route) => route.datePublished,
        Order.flip(Order.Number)
      ).slice(0, RSS_CONTENT_ROUTE_LIMIT);
    })
  );
}

/** Selects signed published articles. */
const readFeedArticles = Effect.fn("www.rss.readArticles")(function* (
  locale: (typeof routing.locales)[number],
  expectedActiveReleaseId: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const published = yield* readPublishedLatestArticles(
    locale,
    RSS_CONTENT_ROUTE_LIMIT,
    expectedActiveReleaseId
  );
  return Arr.map(published.articles, (article) => ({
    authors: article.authors,
    appLocale,
    datePublished: Date.parse(`${article.datePublished}T00:00:00.000Z`),
    dateModified: Date.parse(
      `${article.dateModified ?? article.datePublished}T00:00:00.000Z`
    ),
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
    RSS_CONTENT_ROUTE_LIMIT,
    expectedActiveReleaseId
  );
  const publishedRoutes = Arr.map(published.materials, (material) => ({
    authors: material.authors,
    datePublished: Date.parse(`${material.datePublished}T00:00:00.000Z`),
    dateModified: Date.parse(
      `${material.dateModified ?? material.datePublished}T00:00:00.000Z`
    ),
    description: material.description,
    appLocale,
    route: material.publicPath,
    sourcePath: material.sourcePath,
    title: material.title,
  }));
  return publishedRoutes;
});
