import "server-only";

import { GitCommitShaSchema } from "@nakafa/aksara-contracts/ids";
import {
  type ArticleCategory,
  ArticleCategorySchema,
  ArticleCategoryTitleSchema,
  ArticleProjectionSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import type { Locale } from "next-intl";
import { applyPublishedCatalogCache } from "@/lib/content/cache";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

const articlePageSize = 32;

/** Stable source root for immutable Aksara article links. */
export const ARTICLE_SOURCE_ROOT = "packages/corpus/articles";

type ArticlePageArgs = FunctionArgs<typeof api.contentRelease.article.page>;
type ArticlePageResult = FunctionReturnType<
  typeof api.contentRelease.article.page
>;
type ArticlePageItem = ArticlePageResult["result"]["page"][number];
type CategoryPageArgs = FunctionArgs<
  typeof api.contentRelease.article.categories
>;
type CategoryPageResult = FunctionReturnType<
  typeof api.contentRelease.article.categories
>;
type CategoryPageItem = CategoryPageResult["result"]["page"][number];

/** Active release identity required to continue one stable catalog read. */
export interface ArticlePageCursor {
  readonly cursor: null | string;
  readonly expectedManifestHash: null | string;
  readonly expectedReleaseId: null | string;
}

/** One localized category title verified against the active article model. */
export interface PublishedArticleCategory {
  readonly category: ArticleCategory;
  readonly rendererDomain: CategoryPageItem["rendererDomain"];
  readonly title: typeof ArticleCategoryTitleSchema.Type;
}

/** One verified article card selected from the active Aksara release. */
export interface PublishedArticleSummary {
  readonly authors: (typeof ArticleProjectionSchema.Type)["metadata"]["authors"];
  readonly category: ArticleCategory;
  readonly categoryTitle: typeof ArticleCategoryTitleSchema.Type;
  readonly date: (typeof ArticleProjectionSchema.Type)["metadata"]["date"];
  readonly description: string;
  readonly official: boolean;
  readonly publicPath: (typeof ArticleProjectionSchema.Type)["publicPath"];
  readonly slug: (typeof ArticleProjectionSchema.Type)["articleSlug"];
  readonly title: string;
}

/** One bounded active article page with immutable provenance. */
export interface PublishedArticlePage {
  readonly activeManifestHash: null | string;
  readonly activeReleaseId: null | string;
  readonly articles: readonly PublishedArticleSummary[];
  readonly done: boolean;
  readonly managed: boolean;
  readonly nextCursor: null | string;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
  readonly stale: boolean;
}

/** One bounded active category page with immutable provenance. */
export interface PublishedCategoryPage {
  readonly activeManifestHash: null | string;
  readonly activeReleaseId: null | string;
  readonly categories: readonly PublishedArticleCategory[];
  readonly done: boolean;
  readonly managed: boolean;
  readonly nextCursor: null | string;
  readonly sourceRevision: null | typeof GitCommitShaSchema.Type;
  readonly stale: boolean;
}

/** Maps one malformed catalog field to the public projection failure contract. */
function projectionError(locale: Locale, publicPath = "articles") {
  return new PublishedProjectionError({ locale, publicPath });
}

/** Decodes optional Git provenance from one verified active release. */
const decodeSourceRevision = Effect.fn("www.articles.decodeSourceRevision")(
  function* (source: null | string, locale: Locale) {
    if (source === null) {
      return null;
    }
    return yield* Schema.decodeUnknown(GitCommitShaSchema)(source).pipe(
      Effect.mapError(() => projectionError(locale))
    );
  }
);

/** Strictly decodes one backend-verified article catalog row. */
const decodeArticleItem = Effect.fn("www.articles.decodeItem")(function* (
  item: ArticlePageItem,
  locale: Locale
) {
  const input = yield* Effect.try({
    catch: () => projectionError(locale),
    try: (): unknown => JSON.parse(item.projectionJson),
  });
  const projection = yield* Schema.decodeUnknown(ArticleProjectionSchema)(
    input,
    { onExcessProperty: "error" }
  ).pipe(Effect.mapError(() => projectionError(locale, item.publicPath)));
  if (
    item.family !== "article" ||
    item.locale !== locale ||
    projection.locale !== locale ||
    projection.contentKey !== item.contentKey ||
    projection.publicPath !== item.publicPath
  ) {
    return yield* projectionError(locale, item.publicPath);
  }
  return {
    authors: projection.metadata.authors,
    category: projection.category,
    categoryTitle: projection.categoryTitle,
    date: projection.metadata.date,
    description: projection.metadata.description ?? "",
    official: projection.official,
    publicPath: projection.publicPath,
    slug: projection.articleSlug,
    title: projection.metadata.title,
  } satisfies PublishedArticleSummary;
});

/** Strictly decodes one backend-verified category catalog row. */
const decodeCategoryItem = Effect.fn("www.articles.decodeCategory")(function* (
  item: CategoryPageItem,
  locale: Locale
) {
  const [category, title] = yield* Effect.all([
    Schema.decodeUnknown(ArticleCategorySchema)(item.category),
    Schema.decodeUnknown(ArticleCategoryTitleSchema)(item.title),
  ]).pipe(Effect.mapError(() => projectionError(locale)));
  return {
    category,
    rendererDomain: item.rendererDomain,
    title,
  } satisfies PublishedArticleCategory;
});

/** Reads and decodes one exact category's newest-first article page. */
export const readPublishedArticlePage = Effect.fn(
  "www.articles.readPublishedPage"
)(function* (
  input: ArticlePageCursor & {
    readonly category: ArticleCategory;
    readonly locale: Locale;
  }
) {
  const args = {
    category: input.category,
    expectedManifestHash: input.expectedManifestHash,
    expectedReleaseId: input.expectedReleaseId,
    locale: input.locale,
    paginationOpts: {
      cursor: input.cursor,
      numItems: articlePageSize,
    },
  } satisfies ArticlePageArgs;
  const result = yield* readRuntimeQuery("contentRelease.article.page", () =>
    fetchRuntimeQuery(api.contentRelease.article.page, args)
  );
  const articles = yield* Effect.forEach(result.result.page, (item) =>
    decodeArticleItem(item, input.locale)
  );
  const sourceRevision = yield* decodeSourceRevision(
    result.sourceRevision,
    input.locale
  );
  const activeManifestHash = result.activeManifestHash;
  const activeReleaseId = result.activeReleaseId;
  const nextCursor = result.result.isDone ? null : result.result.continueCursor;
  if (
    nextCursor !== null &&
    (activeManifestHash === null || activeReleaseId === null)
  ) {
    return yield* projectionError(input.locale);
  }
  return {
    activeManifestHash,
    activeReleaseId,
    articles,
    done: result.result.isDone,
    managed: result.managed,
    nextCursor,
    sourceRevision,
    stale: result.stale,
  } satisfies PublishedArticlePage;
});

/** Reads and decodes one localized article-category page. */
export const readPublishedCategories = Effect.fn(
  "www.articles.readPublishedCategories"
)(function* (
  input: ArticlePageCursor & {
    readonly locale: Locale;
  }
) {
  const args = {
    expectedManifestHash: input.expectedManifestHash,
    expectedReleaseId: input.expectedReleaseId,
    locale: input.locale,
    paginationOpts: {
      cursor: input.cursor,
      numItems: articlePageSize,
    },
  } satisfies CategoryPageArgs;
  const result = yield* readRuntimeQuery(
    "contentRelease.article.categories",
    () => fetchRuntimeQuery(api.contentRelease.article.categories, args)
  );
  const categories = yield* Effect.forEach(result.result.page, (item) =>
    decodeCategoryItem(item, input.locale)
  );
  const sourceRevision = yield* decodeSourceRevision(
    result.sourceRevision,
    input.locale
  );
  const activeManifestHash = result.activeManifestHash;
  const activeReleaseId = result.activeReleaseId;
  const nextCursor = result.result.isDone ? null : result.result.continueCursor;
  if (
    nextCursor !== null &&
    (activeManifestHash === null || activeReleaseId === null)
  ) {
    return yield* projectionError(input.locale);
  }
  return {
    activeManifestHash,
    activeReleaseId,
    categories,
    done: result.result.isDone,
    managed: result.managed,
    nextCursor,
    sourceRevision,
    stale: result.stale,
  } satisfies PublishedCategoryPage;
});

/** Caches one bounded article page under exact article release tags. */
export async function getPublishedArticlePage(
  input: ArticlePageCursor & {
    readonly category: ArticleCategory;
    readonly locale: Locale;
  }
) {
  "use cache";

  const page = await Effect.runPromise(readPublishedArticlePage(input));
  applyPublishedCatalogCache("article");
  return page;
}

/** Caches one bounded category page under exact article release tags. */
export async function getPublishedCategories(
  input: ArticlePageCursor & {
    readonly locale: Locale;
  }
) {
  "use cache";

  const page = await Effect.runPromise(readPublishedCategories(input));
  applyPublishedCatalogCache("article");
  return page;
}
