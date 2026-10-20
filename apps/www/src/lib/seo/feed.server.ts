import { makeContentCacheTag } from "@nakafa/aksara-contracts/cache/content";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  DEFAULT_LOCALE,
  LOCALES,
  type Locale,
} from "@repo/internationalization/src/locale";
import { readServerTranslator } from "@repo/internationalization/src/translator";
import { COMPANY_IDENTITY } from "@repo/seo/company";
import { Array as Arr, DateTime, Effect, Order, Schema } from "effect";
import { Feed, type Item } from "feed";
import { captureServerExceptionSafely } from "@/lib/analytics/exception.server";
import { readPublishedLatestArticles } from "@/lib/content/article/discovery";
import { readPublishedLatestMaterials } from "@/lib/content/material/discovery";
import { loadActiveContentIdentity } from "@/lib/content/published/active";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  type ContentReleasePin,
  decodeContentReleasePin,
} from "@/lib/content/published/release";
import { runServerEffect } from "@/lib/server/fn";

const baseUrl = COMPANY_IDENTITY.url;
const FEED_ERROR = "Internal Server Error";
const PLAIN_TEXT = { "Content-Type": "text/plain; charset=utf-8" };
const RSS_CONTENT_ROUTE_LIMIT = 100;

/**
 * The feed lives on the CDN for a day. Its two content scopes name it, so a
 * release that changes an article or a material purges it with the content.
 */
export const RSS_HEADERS = {
  "Cache-Control":
    "public, max-age=0, s-maxage=86400, stale-while-revalidate=86400",
  "Content-Type": "application/rss+xml; charset=utf-8",
  "Vercel-Cache-Tag": Arr.join(
    [makeContentCacheTag("article"), makeContentCacheTag("material")],
    ","
  ),
};

/** One feed entry, read from a signed article or material of one locale. */
const FeedContentRouteSchema = Schema.Struct({
  appLocale: AppLocaleSchema,
  authors: Schema.Array(Schema.Struct({ name: Schema.String })),
  dateModified: Schema.Finite,
  datePublished: Schema.Finite,
  description: Schema.UndefinedOr(Schema.String),
  route: Schema.String,
  title: Schema.String,
});
type FeedContentRoute = typeof FeedContentRouteSchema.Type;

/** Reports one failed feed, then answers the plain-text 500 without its details. */
function reportFeedFailure(cause: unknown) {
  return captureServerExceptionSafely(cause, { source: "rss-feed" }).pipe(
    Effect.as(new Response(FEED_ERROR, { headers: PLAIN_TEXT, status: 500 }))
  );
}

/** Serves the RSS feed of the latest signed articles and materials. */
export function serveRssFeed() {
  return runServerEffect(
    readFeed().pipe(
      Effect.map((xml) => new Response(xml, { headers: RSS_HEADERS })),
      Effect.catch(reportFeedFailure)
    )
  );
}

/** Builds the RSS document from the latest signed routes of every locale. */
const readFeed = Effect.fn("www.rss.readFeed")(function* () {
  const [t, tCommon, routes] = yield* Effect.all(
    [
      Effect.promise(() =>
        readServerTranslator({
          locale: DEFAULT_LOCALE,
          namespace: "Metadata",
        })
      ),
      Effect.promise(() =>
        readServerTranslator({
          locale: DEFAULT_LOCALE,
          namespace: "Common",
        })
      ),
      getFeedContentRoutes(),
    ],
    { concurrency: "unbounded" }
  );

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
    language: DEFAULT_LOCALE,
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
      author: [...route.authors],
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
});

/** Reads the article and material routes of every locale from one active release. */
const getFeedContentRoutes = Effect.fn("www.rss.readRoutes")(function* () {
  // The feed reads Convex directly and stores nothing, so it pins the release
  // as Convex holds it now. A stored pointer that still names the previous
  // release would pin every read to a release that is gone.
  const active = yield* loadActiveContentIdentity();
  if (!active) {
    return yield* new PublishedProjectionError({
      appLocale: AppLocaleSchema.make(DEFAULT_LOCALE),
      publicPath: "rss.xml",
    });
  }
  const activeReleaseId = active.releaseId;
  const routes = yield* Effect.forEach(
    LOCALES,
    (locale) =>
      Effect.all([
        readFeedArticles(locale, activeReleaseId),
        readFeedMaterials(locale, activeReleaseId),
      ]),
    { concurrency: LOCALES.length }
  );
  const latest = yield* loadActiveContentIdentity();
  yield* decodeContentReleasePin(latest?.releaseId, activeReleaseId, {
    appLocale: AppLocaleSchema.make(DEFAULT_LOCALE),
    publicPath: "rss.xml",
  });

  return Arr.take(
    Arr.sortWith(
      Arr.flatten(Arr.flatten(routes)),
      (route) => route.datePublished,
      Order.flip(Order.Number)
    ),
    RSS_CONTENT_ROUTE_LIMIT
  );
});

/** Selects the signed published articles of one locale. */
const readFeedArticles = Effect.fn("www.rss.readArticles")(function* (
  locale: Locale,
  expectedActiveReleaseId: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const published = yield* readPublishedLatestArticles(
    locale,
    RSS_CONTENT_ROUTE_LIMIT,
    expectedActiveReleaseId
  );
  return Arr.map(
    published.articles,
    (article): FeedContentRoute => ({
      authors: article.authors,
      appLocale,
      datePublished: Date.parse(`${article.datePublished}T00:00:00.000Z`),
      dateModified: Date.parse(
        `${article.dateModified ?? article.datePublished}T00:00:00.000Z`
      ),
      description: article.description,
      route: article.publicPath,
      title: article.title,
    })
  );
});

/** Selects the signed published materials of one locale. */
const readFeedMaterials = Effect.fn("www.rss.readMaterials")(function* (
  locale: Locale,
  expectedActiveReleaseId: ContentReleasePin
) {
  const appLocale = AppLocaleSchema.make(locale);
  const published = yield* readPublishedLatestMaterials(
    locale,
    RSS_CONTENT_ROUTE_LIMIT,
    expectedActiveReleaseId
  );
  return Arr.map(
    published.materials,
    (material): FeedContentRoute => ({
      authors: material.authors,
      datePublished: Date.parse(`${material.datePublished}T00:00:00.000Z`),
      dateModified: Date.parse(
        `${material.dateModified ?? material.datePublished}T00:00:00.000Z`
      ),
      description: material.description,
      appLocale,
      route: material.publicPath,
      title: material.title,
    })
  );
});
