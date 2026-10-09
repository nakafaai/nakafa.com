import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { Effect } from "effect";
import { HttpBody, HttpClient } from "effect/http";
import { IndexNowSubmitError } from "@/scripts/indexing/errors";
import {
  INDEXING_HOSTNAME,
  INDEXNOW_KEY_LOCATION,
} from "@/scripts/indexing/paths";

const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY = 1000;
const HTTP_STATUS_CODE_OK = 200;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
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
    yield* Effect.logInfo("No new URLs to submit to IndexNow.");
    return [];
  }

  const batches = chunkIndexNowUrls(urls);
  const successfullySubmitted: string[] = [];

  yield* Effect.logInfo(`Submitting ${urls.length} URLs to IndexNow...`);

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

  yield* Effect.logInfo(
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
  yield* Effect.logInfo(
    `Submitting batch ${batchCount} of ${totalBatches}: ${batchCount}/${totalBatches} (${Math.round((batchCount / totalBatches) * 100)}%)`
  );

  const client = yield* HttpClient.HttpClient;
  const status = yield* client
    .post(INDEXNOW_ENDPOINT, {
      body: HttpBody.jsonUnsafe(
        {
          host: INDEXING_HOSTNAME,
          key,
          keyLocation: INDEXNOW_KEY_LOCATION,
          urlList: batch,
        },
        JSON_CONTENT_TYPE
      ),
    })
    .pipe(
      Effect.map((response) => response.status),
      Effect.mapError(
        (cause) =>
          new IndexNowSubmitError({
            cause,
            message: `Error submitting IndexNow batch ${batchCount}.`,
          })
      ),
      Effect.timeoutOrElse({
        duration: NETWORK_ATTEMPT_DEADLINE,
        orElse: () =>
          Effect.fail(
            new IndexNowSubmitError({
              cause: "deadline",
              message: `IndexNow batch ${batchCount} did not answer within 10 seconds.`,
            })
          ),
      })
    );

  if (status !== HTTP_STATUS_CODE_OK) {
    return yield* new IndexNowSubmitError({
      cause: status,
      message: `IndexNow batch ${batchCount} failed with HTTP ${status}.`,
    });
  }

  yield* Effect.logInfo(`Batch ${batchCount} completed (${batch.length} URLs)`);
  return [...batch];
});
