import { Effect } from "effect";
import { IndexNowSubmitError } from "@/scripts/indexing/errors";
import {
  INDEXING_HOSTNAME,
  INDEXNOW_KEY_LOCATION,
} from "@/scripts/indexing/paths";
import { logger } from "@/scripts/utils";

const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY = 1000;
const HTTP_STATUS_CODE_OK = 200;
const INDEXNOW_ENDPOINT = "https://api.indexnow.org";

/** Splits canonical sitemap URLs into IndexNow's supported batch size. */
export function chunkIndexNowUrls(urls: readonly string[]) {
  const batches: string[][] = [];

  for (let index = 0; index < urls.length; index += BATCH_SIZE) {
    batches.push(urls.slice(index, index + BATCH_SIZE));
  }

  return batches;
}

/**
 * Submits canonical sitemap URLs to the IndexNow endpoint.
 *
 * The caller supplies sitemap-derived URLs and the public verification key, so
 * this adapter does not own route discovery or a private credential.
 */
export const submitUrlsToIndexNow = Effect.fn(
  "scripts.indexing.indexNow.submitUrls"
)(function* (urls: readonly string[], key: string) {
  if (urls.length === 0) {
    logger.info("No new URLs to submit to IndexNow.");
    return [];
  }

  const batches = chunkIndexNowUrls(urls);
  const successfullySubmitted: string[] = [];

  logger.info(`Submitting ${urls.length} URLs to IndexNow...`);

  for (const [index, batch] of batches.entries()) {
    const batchResult = yield* submitBatchToIndexNow({
      batch,
      batchCount: index + 1,
      key,
      totalBatches: batches.length,
    });
    successfullySubmitted.push(...batchResult);

    if (index < batches.length - 1) {
      yield* Effect.sleep(RATE_LIMIT_DELAY);
    }
  }

  logger.info(
    `IndexNow submission completed. Successfully submitted ${successfullySubmitted.length}/${urls.length} URLs.`
  );

  return successfullySubmitted;
});

/** Submits one IndexNow batch and fails if the endpoint rejects it. */
const submitBatchToIndexNow = Effect.fn(
  "scripts.indexing.indexNow.submitBatch"
)(function* ({
  batch,
  batchCount,
  key,
  totalBatches,
}: {
  batch: readonly string[];
  batchCount: number;
  key: string;
  totalBatches: number;
}) {
  logger.progress(
    batchCount,
    totalBatches,
    `Submitting batch ${batchCount} of ${totalBatches}`
  );

  const status = yield* Effect.tryPromise({
    catch: (cause) =>
      new IndexNowSubmitError({
        cause,
        message: `Error submitting IndexNow batch ${batchCount}.`,
      }),
    try: () =>
      fetch(INDEXNOW_ENDPOINT, {
        body: JSON.stringify({
          host: INDEXING_HOSTNAME,
          key,
          keyLocation: INDEXNOW_KEY_LOCATION,
          urlList: batch,
        }),
        headers: {
          "Content-Type": "application/json; charset=utf-8",
        },
        method: "POST",
      }).then((response) => response.status),
  });

  if (status !== HTTP_STATUS_CODE_OK) {
    return yield* Effect.fail(
      new IndexNowSubmitError({
        cause: status,
        message: `IndexNow batch ${batchCount} failed with HTTP ${status}.`,
      })
    );
  }

  logger.success(`Batch ${batchCount} completed (${batch.length} URLs)`);
  return [...batch];
});
