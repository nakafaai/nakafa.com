import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import {
  computeHash,
  parseDateToEpoch,
  readArticleReferences,
  readMdxFile,
} from "../lib/mdx-parser/content";
import { getArticleDir, parseArticlePath } from "../lib/mdx-parser/paths";
import { runConvexMutation } from "./convexApi";
import { formatDuration, log, logError, logSuccess } from "./logging";
import {
  createBatchProgress,
  formatBatchProgress,
  updateBatchProgress,
} from "./metrics";
import { globFiles } from "./runtime";
import { BATCH_SIZES } from "./schemas";
import type { ConvexConfig, SyncOptions, SyncResult } from "./types";

interface ArticlePayload {
  articleSlug: string;
  authors: Array<{ name: string }>;
  body: string;
  category: string;
  contentHash: string;
  date: number;
  description?: string;
  locale: Locale;
  references: Array<{
    authors: string;
    citation?: string;
    details?: string;
    publication?: string;
    title: string;
    url?: string;
    year: number;
  }>;
  slug: string;
  title: string;
}

export const syncArticles = async (
  config: ConvexConfig,
  options: SyncOptions
): Promise<SyncResult> => {
  const startTime = performance.now();
  if (!options.quiet) {
    log("\n--- ARTICLES ---\n");
  }

  const pattern = options.locale
    ? `articles/**/${options.locale}.mdx`
    : "articles/**/*.mdx";
  const files = await globFiles(pattern);

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
    try {
      const pathInfo = parseArticlePath(file);
      const { metadata, body } = await readMdxFile(file);
      const articleDir = getArticleDir(file);
      const references = await readArticleReferences(articleDir);
      const contentHash = computeHash(
        body + JSON.stringify(references) + JSON.stringify(metadata.authors)
      );

      articles.push({
        locale: pathInfo.locale,
        slug: pathInfo.slug,
        category: pathInfo.category,
        articleSlug: pathInfo.articleSlug,
        title: metadata.title,
        description: metadata.description,
        date: parseDateToEpoch(metadata.date),
        body,
        contentHash,
        authors: metadata.authors,
        references,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${file}: ${message}`);
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

    const result = await runConvexMutation(
      config,
      "contentSync/mutations:bulkSyncArticles",
      { articles: batch }
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
};
