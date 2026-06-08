import { internal } from "@repo/backend/convex/_generated/api";
import {
  computeHash,
  parseDateToEpoch,
  readArticleReferences,
  readMdxFile,
} from "@repo/backend/scripts/lib/mdx-parser/content";
import {
  getArticleDir,
  parseArticlePath,
} from "@repo/backend/scripts/lib/mdx-parser/paths";
import { callConvexMutation } from "@repo/backend/scripts/sync-content/convex";
import {
  formatDuration,
  log,
  logError,
  logSuccess,
} from "@repo/backend/scripts/sync-content/logging";
import {
  createBatchProgress,
  formatBatchProgress,
  updateBatchProgress,
} from "@repo/backend/scripts/sync-content/metrics";
import { globFiles } from "@repo/backend/scripts/sync-content/runtime";
import {
  ArticleSyncResultSchema,
  BATCH_SIZES,
} from "@repo/backend/scripts/sync-content/schemas";
import type {
  ConvexConfig,
  SyncOptions,
  SyncResult,
} from "@repo/backend/scripts/sync-content/types";
import type { FunctionArgs } from "convex/server";
import { Effect } from "effect";

type ArticlePayload = FunctionArgs<
  typeof internal.contentSync.mutations.articles.bulkSyncArticles
>["articles"][number];

/** Syncs article MDX files and their references into Convex. */
export const syncArticles = Effect.fn("sync.articles")(function* (
  config: ConvexConfig,
  options: SyncOptions
) {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- ARTICLES ---\n");
  }

  const pattern = options.locale
    ? `articles/**/${options.locale}.mdx`
    : "articles/**/*.mdx";
  const files = yield* globFiles(pattern);

  if (!options.quiet) {
    log(`Files found: ${files.length}`);
  }

  const totals: SyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    referencesCreated: 0,
    authorLinksCreated: 0,
  };
  const articles: ArticlePayload[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const result = yield* Effect.either(
      Effect.gen(function* () {
        const pathInfo = yield* parseArticlePath(file);
        const { metadata, body } = yield* readMdxFile(file);
        const articleDir = getArticleDir(file);
        const references = yield* readArticleReferences(articleDir);
        const date = yield* parseDateToEpoch(metadata.date);
        const contentHash = computeHash(
          JSON.stringify({
            articleSlug: pathInfo.articleSlug,
            authors: metadata.authors,
            body,
            category: pathInfo.category,
            date,
            description: metadata.description,
            locale: pathInfo.locale,
            references,
            slug: pathInfo.slug,
            title: metadata.title,
          })
        );

        return {
          locale: pathInfo.locale,
          slug: pathInfo.slug,
          category: pathInfo.category,
          articleSlug: pathInfo.articleSlug,
          title: metadata.title,
          description: metadata.description,
          date,
          body,
          contentHash,
          authors: metadata.authors,
          references,
        };
      })
    );

    if (result._tag === "Left") {
      const message =
        result.left instanceof Error
          ? result.left.message
          : String(result.left);
      errors.push(`${file}: ${message}`);
    } else {
      articles.push(result.right);
    }
  }

  if (errors.length > 0 && !options.quiet) {
    log(`Parse errors: ${errors.length}`);
    for (const error of errors) {
      logError(error);
    }
  }

  const totalBatches = Math.ceil(articles.length / BATCH_SIZES.articles);
  const progress = createBatchProgress(articles.length, BATCH_SIZES.articles);

  for (let index = 0; index < articles.length; index += BATCH_SIZES.articles) {
    const batch = articles.slice(index, index + BATCH_SIZES.articles);
    const batchNum = Math.floor(index / BATCH_SIZES.articles) + 1;

    if (!options.quiet) {
      log(formatBatchProgress(progress, batchNum, totalBatches, batch.length));
    }

    const result = yield* callConvexMutation(
      config,
      internal.contentSync.mutations.articles.bulkSyncArticles,
      { articles: batch },
      ArticleSyncResultSchema
    );

    totals.created += result.created;
    totals.updated += result.updated;
    totals.unchanged += result.unchanged;
    totals.referencesCreated =
      (totals.referencesCreated || 0) + (result.referencesCreated || 0);
    totals.authorLinksCreated =
      (totals.authorLinksCreated || 0) + (result.authorLinksCreated || 0);
    updateBatchProgress(progress, batch.length);
  }

  const processed = totals.created + totals.updated + totals.unchanged;
  const durationMs = performance.now() - startTime;
  const itemsPerSecond = durationMs > 0 ? (processed / durationMs) * 1000 : 0;

  if (!options.quiet) {
    log(
      `\nResult: ${totals.created} created, ${totals.updated} updated, ${totals.unchanged} unchanged`
    );
    if (totals.referencesCreated || totals.authorLinksCreated) {
      log(
        `Related: ${totals.referencesCreated || 0} references, ${totals.authorLinksCreated || 0} author links`
      );
    }
    log(
      `Time: ${formatDuration(durationMs)} (${itemsPerSecond.toFixed(1)} items/sec)`
    );

    if (processed === articles.length) {
      logSuccess(`${processed}/${files.length} files synced`);
    } else {
      logError(`Mismatch: ${processed} processed vs ${articles.length} parsed`);
    }
  }

  return { ...totals, durationMs, itemsPerSecond };
});
