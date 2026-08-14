import "server-only";

import { DateOnlySchema } from "@nakafa/aksara-contracts/date";
import { PublicPathSchema } from "@nakafa/aksara-contracts/ids";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
  ArticleSlugSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import type { PublishedArticleSummary } from "@/lib/content/article/catalog";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import { readRuntimeQuery } from "@/lib/content/runtime/query";

type DiscoveryItem = FunctionReturnType<
  typeof api.contentRelease.article.latest
>["articles"][number];

/** Decodes one backend-verified discovery row into the article card contract. */
const decodeDiscoveryItem = Effect.fn("www.articles.decodeDiscovery")(
  function* (item: DiscoveryItem, locale: Locale) {
    const appLocale = AppLocaleSchema.make(locale);
    const [category, categoryTitle, date, publicPath, slug] = yield* Effect.all(
      [
        Schema.decodeUnknown(ArticleCategorySchema)(item.category),
        Schema.decodeUnknown(ArticleCategoryTitleSchema)(item.categoryTitle),
        Schema.decodeUnknown(DateOnlySchema)(item.date),
        Schema.decodeUnknown(PublicPathSchema)(item.publicPath),
        Schema.decodeUnknown(ArticleSlugSchema)(item.articleSlug),
      ]
    ).pipe(
      Effect.mapError(
        () =>
          new PublishedProjectionError({
            appLocale,
            publicPath: item.publicPath,
          })
      )
    );

    return {
      authors: item.authors,
      category,
      categoryTitle,
      date,
      description: item.description ?? "",
      official: item.official,
      publicPath,
      slug,
      title: item.title,
    } satisfies PublishedArticleSummary;
  }
);

/** Reads one complete published article partition for agent discovery. */
export const readPublishedArticleBucket = Effect.fn("www.articles.readBucket")(
  function* (locale: Locale, bucket: string) {
    const appLocale = AppLocaleSchema.make(locale);
    const result = yield* readRuntimeQuery(api.contentRelease.article.bucket, {
      appLocale,
      bucket,
    });
    if (!result.managed) {
      return yield* new PublishedProjectionError({
        appLocale,
        publicPath: "articles",
      });
    }
    if (result.articles === null) {
      return { articles: null };
    }
    const articles = yield* Effect.forEach(result.articles, (article) =>
      decodeDiscoveryItem(article, locale)
    );
    return { articles };
  }
);

/** Reads a bounded newest-first article set for feed discovery. */
export const readPublishedLatestArticles = Effect.fn("www.articles.readLatest")(
  function* (locale: Locale, limit: number) {
    const appLocale = AppLocaleSchema.make(locale);
    const result = yield* readRuntimeQuery(api.contentRelease.article.latest, {
      appLocale,
      limit,
    });
    if (!result.managed) {
      return yield* new PublishedProjectionError({
        appLocale,
        publicPath: "articles",
      });
    }
    const articles = yield* Effect.forEach(result.articles, (article) =>
      decodeDiscoveryItem(article, locale)
    );
    return { articles };
  }
);

/** Reads a bounded newest-first article set for one exact category. */
export const readPublishedCategoryArticles = Effect.fn(
  "www.articles.readCategory"
)(function* (locale: Locale, category: string, limit: number) {
  const appLocale = AppLocaleSchema.make(locale);
  const result = yield* readRuntimeQuery(api.contentRelease.article.listing, {
    appLocale,
    category,
    limit,
  });
  if (!result.managed) {
    return yield* new PublishedProjectionError({
      appLocale,
      publicPath: `articles/${category}`,
    });
  }
  const articles = yield* Effect.forEach(result.articles, (article) =>
    decodeDiscoveryItem(article, locale)
  );
  return { articles };
});
