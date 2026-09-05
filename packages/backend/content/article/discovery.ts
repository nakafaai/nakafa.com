import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { readArticlePartition } from "@repo/backend/content/article/partition";
import { ArticleSource } from "@repo/backend/content/article/source";
import { verifyArticle } from "@repo/backend/content/article/verify";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

const ARTICLE_DISCOVERY_LIMIT = 100;
/** Validates one bounded discovery read before accessing an article index. */
const validateDiscoveryLimit = Effect.fn(
  "contentRelease.validateArticleDiscoveryLimit"
)(function* (limit: number) {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > ARTICLE_DISCOVERY_LIMIT
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_LIMIT",
      `Article discovery accepts 1 to ${ARTICLE_DISCOVERY_LIMIT} rows.`
    );
  }
});
/** Selects the compact fields needed by RSS and agent-facing indexes. */
function summarizeArticle(
  verified: Effect.Success<ReturnType<typeof verifyArticle>>
) {
  const { projection } = verified;
  return {
    articleSlug: projection.articleSlug,
    authors: projection.metadata.authors.map(({ name }) => ({ name })),
    category: projection.category,
    categoryTitle: projection.categoryTitle,
    ...(projection.metadata.dateModified === undefined
      ? {}
      : { dateModified: projection.metadata.dateModified }),
    datePublished: projection.metadata.datePublished,
    description: projection.metadata.description,
    official: projection.official,
    publicPath: projection.publicPath,
    route: {
      category: projection.categoryRouteSlug,
      slug: projection.articleRouteSlug,
    },
    title: projection.metadata.title,
  };
}

/** Reads one complete hash partition for a managed article index. */
export const readArticleBucket = Effect.fn("contentRelease.readArticleBucket")(
  function* (
    appLocale: Parameters<typeof loadArticleOwner>[0],
    bucket: string
  ) {
    const partition = yield* readArticlePartition(appLocale, bucket);
    if (partition.kind === "unmanaged") {
      return {
        activeReleaseId: partition.activeReleaseId,
        articles: null,
        managed: false,
      };
    }
    if (partition.kind === "missing") {
      return {
        activeReleaseId: partition.activeReleaseId,
        articles: null,
        managed: true,
      };
    }
    return {
      activeReleaseId: partition.activeReleaseId,
      articles: partition.articles.map(summarizeArticle),
      managed: true,
    };
  }
);
/** Reads a bounded newest-first article set from the active owner. */
export const readLatestArticles = Effect.fn(
  "contentRelease.readLatestArticles"
)(function* (appLocale: Parameters<typeof loadArticleOwner>[0], limit: number) {
  yield* validateDiscoveryLimit(limit);
  const owner = yield* loadArticleOwner(appLocale);
  const activeReleaseId = owner.active?.releaseId ?? null;
  if (!(owner.managed && owner.active && owner.slot)) {
    return { activeReleaseId, articles: [], managed: false };
  }
  const source = yield* ArticleSource;
  const rows = yield* source.ordered(owner.slot, appLocale, null, limit);
  const verified = yield* Effect.forEach(rows, (article) =>
    verifyArticle(article, owner.active.sequence)
  );
  return {
    activeReleaseId,
    articles: verified.map(summarizeArticle),
    managed: true,
  };
});
/** Reads a bounded newest-first article set for one managed category. */
export const readCategoryArticles = Effect.fn(
  "contentRelease.readCategoryArticles"
)(function* (
  appLocale: Parameters<typeof loadArticleOwner>[0],
  category: string,
  limit: number
) {
  yield* validateDiscoveryLimit(limit);
  const owner = yield* loadArticleOwner(appLocale);
  const activeReleaseId = owner.active?.releaseId ?? null;
  if (!(owner.managed && owner.active && owner.slot)) {
    return { activeReleaseId, articles: [], managed: false };
  }
  const source = yield* ArticleSource;
  const rows = yield* source.ordered(owner.slot, appLocale, category, limit);
  const verified = yield* Effect.forEach(rows, (article) =>
    verifyArticle(article, owner.active.sequence)
  );
  return {
    activeReleaseId,
    articles: verified.map(summarizeArticle),
    managed: true,
  };
});
