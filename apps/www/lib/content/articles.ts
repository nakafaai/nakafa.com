import "server-only";

import type {
  CorpusSourcePath,
  GitCommitSha,
} from "@nakafa/aksara-contracts/ids";
import {
  CorpusSourcePathSchema,
  GitCommitShaSchema,
} from "@nakafa/aksara-contracts/ids";
import {
  type ArticleCategory,
  type ArticleProjection,
  ArticleProjectionSchema,
} from "@nakafa/aksara-contracts/projection/article";
import { api } from "@repo/backend/convex/_generated/api";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { Effect, Schema } from "effect";
import { applyPublishedCatalogCache } from "@/lib/content/cache";
import { PublishedProjectionError } from "@/lib/content/published/errors";
import {
  fetchRuntimeQuery,
  readRuntimeQuery,
} from "@/lib/content/runtime/query";

type ArticlePageArgs = FunctionArgs<typeof api.contentRelease.article.page>;
type ArticlePageResult = FunctionReturnType<
  typeof api.contentRelease.article.page
>;
type ArticlePageItem = ArticlePageResult["items"][number];

/** One verified article card selected from the active Aksara release. */
export interface PublishedArticleSummary {
  readonly category: ArticleProjection["category"];
  readonly date: ArticleProjection["metadata"]["date"];
  readonly description: ArticleProjection["metadata"]["description"];
  readonly official: ArticleProjection["official"];
  readonly parentPath: ArticleProjection["parentPath"];
  readonly publicPath: ArticleProjection["publicPath"];
  readonly slug: ArticleProjection["articleSlug"];
  readonly sourcePath: CorpusSourcePath;
  readonly sourceRevision: GitCommitSha | null;
  readonly title: ArticleProjection["metadata"]["title"];
}

/** One bounded active article catalog page with immutable provenance. */
export interface PublishedArticlePage {
  readonly activeReleaseId: null | string;
  readonly articles: readonly PublishedArticleSummary[];
  readonly done: boolean;
  readonly nextCursor: null | string;
}

/** Decodes an optional source revision from the active signed release. */
const decodeSourceRevision = Effect.fn("www.articles.decodeSourceRevision")(
  function* (
    revision: ArticlePageResult["sourceRevision"],
    locale: "en" | "id"
  ) {
    if (revision === null) {
      return null;
    }
    return yield* Schema.decodeUnknown(GitCommitShaSchema)(revision).pipe(
      Effect.mapError(
        () => new PublishedProjectionError({ locale, publicPath: "articles" })
      )
    );
  }
);

/** Strictly decodes one backend-verified article catalog row. */
const decodeArticleItem = Effect.fn("www.articles.decodeItem")(function* (
  item: ArticlePageItem,
  locale: "en" | "id",
  sourceRevision: GitCommitSha | null
) {
  const input = yield* Effect.try({
    catch: () =>
      new PublishedProjectionError({ locale, publicPath: "articles" }),
    try: (): unknown => JSON.parse(item.projectionJson),
  });
  const projection = yield* Schema.decodeUnknown(ArticleProjectionSchema)(
    input,
    { onExcessProperty: "error" }
  ).pipe(
    Effect.mapError(
      () => new PublishedProjectionError({ locale, publicPath: "articles" })
    )
  );
  const sourcePath = yield* Schema.decodeUnknown(CorpusSourcePathSchema)(
    item.sourcePath
  ).pipe(
    Effect.mapError(
      () =>
        new PublishedProjectionError({
          locale,
          publicPath: projection.publicPath,
        })
    )
  );
  if (
    projection.locale !== locale ||
    !sourcePath.startsWith(`packages/corpus/articles/${projection.category}/`)
  ) {
    return yield* new PublishedProjectionError({
      locale,
      publicPath: projection.publicPath,
    });
  }

  return {
    category: projection.category,
    date: projection.metadata.date,
    description: projection.metadata.description,
    official: projection.official,
    parentPath: projection.parentPath,
    publicPath: projection.publicPath,
    slug: projection.articleSlug,
    sourcePath,
    sourceRevision,
    title: projection.metadata.title,
  } satisfies PublishedArticleSummary;
});

/** Reads one public article catalog page through the official Convex client. */
function fetchArticlePage(args: ArticlePageArgs) {
  return fetchRuntimeQuery(api.contentRelease.article.page, args);
}

/** Reads and decodes one bounded active article catalog page. */
export const readPublishedArticlePage = Effect.fn(
  "www.articles.readPublishedPage"
)(function* (args: ArticlePageArgs) {
  const result = yield* readRuntimeQuery("contentRelease.article.page", () =>
    fetchArticlePage(args)
  );
  const sourceRevision = yield* decodeSourceRevision(
    result.sourceRevision,
    args.locale
  );
  const articles: PublishedArticleSummary[] = [];
  for (const item of result.items) {
    articles.push(yield* decodeArticleItem(item, args.locale, sourceRevision));
  }

  return {
    activeReleaseId: result.activeReleaseId,
    articles,
    done: result.done,
    nextCursor: result.nextCursor,
  } satisfies PublishedArticlePage;
});

/** Caches one bounded article catalog page under article release tags. */
export async function getPublishedArticlePage(args: ArticlePageArgs) {
  "use cache";

  const page = await Effect.runPromise(readPublishedArticlePage(args));
  applyPublishedCatalogCache("article");
  return page;
}

/** Selects one category's active articles in newest-first order. */
export function selectCategoryArticles(
  articles: readonly PublishedArticleSummary[],
  category: ArticleCategory
) {
  return articles
    .filter((article) => article.category === category)
    .sort((left, right) => right.date.localeCompare(left.date));
}

/** Selects one representative active article for every published category. */
export function selectArticleCategories(
  articles: readonly PublishedArticleSummary[]
) {
  const categories = new Map<ArticleCategory, PublishedArticleSummary>();
  for (const article of articles) {
    if (!categories.has(article.category)) {
      categories.set(article.category, article);
    }
  }
  return [...categories.values()];
}

/** Resolves an exact Aksara source directory from a verified article row. */
export function getArticleSourceDirectory(
  article: PublishedArticleSummary,
  scope: "category" | "root"
) {
  const categoryRoot = `packages/corpus/articles/${article.category}`;
  return scope === "root" ? "packages/corpus/articles" : categoryRoot;
}
