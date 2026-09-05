import { loadArticleOwner } from "@repo/backend/content/article/owner";
import { readArticlePartition } from "@repo/backend/content/article/partition";
import { ArticleSource } from "@repo/backend/content/article/source";
import {
  CONTENT_BUCKET_LIMIT,
  CONTENT_BUCKET_SIZE,
  isProjectionBucket,
} from "@repo/backend/convex/contentRelease/bucket";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { Effect } from "effect";

/** Lists non-empty deterministic sitemap partitions for managed articles. */
export const readArticleBuckets = Effect.fn(
  "contentRelease.readArticleBuckets"
)(function* (appLocale: Parameters<typeof loadArticleOwner>[0]) {
  const owner = yield* loadArticleOwner(appLocale);
  const activeReleaseId = owner.active?.releaseId ?? null;
  if (!(owner.managed && owner.active && owner.slot)) {
    return {
      activeReleaseId,
      articleCount: 0,
      buckets: [],
      managed: false,
    };
  }

  const source = yield* ArticleSource;
  const rows = yield* source.buckets(
    owner.slot,
    appLocale,
    CONTENT_BUCKET_LIMIT + 1
  );
  if (rows.length > CONTENT_BUCKET_LIMIT) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Article sitemap buckets for ${appLocale} exceed their fixed partition space.`
    );
  }

  for (const row of rows) {
    if (
      !isProjectionBucket(row.bucket) ||
      row.articleCount < 0 ||
      row.categoryCount < 0 ||
      row.articleCount + row.categoryCount === 0 ||
      row.articleCount + row.categoryCount > CONTENT_BUCKET_SIZE
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        `Article sitemap bucket ${appLocale}/${row.bucket} has invalid counts.`
      );
    }
  }

  return {
    activeReleaseId,
    articleCount: rows.reduce(
      (total, { articleCount }) => total + articleCount,
      0
    ),
    buckets: rows.map(({ bucket }) => bucket),
    managed: true,
  };
});

/** Reads one complete bounded sitemap partition from verified article rows. */
export const readArticleSitemap = Effect.fn(
  "contentRelease.readArticleSitemap"
)(function* (
  appLocale: Parameters<typeof loadArticleOwner>[0],
  bucket: string
) {
  const partition = yield* readArticlePartition(appLocale, bucket);
  if (partition.kind !== "found") {
    return null;
  }

  return {
    routes: [
      ...partition.categories.map(({ route }) => ({
        publicPath: `articles/${route}`,
      })),
      ...partition.articles.map(({ projection }) => ({
        lastModified:
          projection.metadata.dateModified ?? projection.metadata.datePublished,
        publicPath: projection.publicPath,
      })),
    ],
  };
});
