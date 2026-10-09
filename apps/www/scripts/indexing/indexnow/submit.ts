import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { Array as Arr, Effect, MutableList, Option, Result } from "effect";
import { HttpBody, HttpClient } from "effect/http";
import { IndexNowSubmitError } from "@/scripts/indexing/errors";
import {
  INDEXING_HOSTNAME,
  INDEXNOW_KEY_LOCATION,
} from "@/scripts/indexing/paths";

const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY = 1000;
const HTTP_STATUS_CODE_OK = 200;
const HTTP_STATUS_CODE_ACCEPTED = 202;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org";

/** Splits canonical sitemap URLs into IndexNow's supported batch size. */
export function chunkIndexNowUrls(urls: readonly string[]) {
  return Arr.chunksOf(urls, BATCH_SIZE);
}

/**
 * Submits canonical sitemap URLs to the IndexNow endpoint.
 *
 * The caller supplies sitemap-derived URLs and the public verification key, so
 * this adapter does not own route discovery or a private credential. Returns the
 * URLs of every batch that IndexNow accepted and, when a batch fails, the typed
 * failure that ended the call.
 */
export const submitUrlsToIndexNow = Effect.fn(
  "scripts.indexing.indexNow.submitUrls"
)(function* (urls: readonly string[], key: string) {
  if (urls.length === 0) {
    yield* Effect.logInfo("No new URLs to submit to IndexNow.");
    return { failure: Option.none(), submittedUrls: [] };
  }

  const batches = chunkIndexNowUrls(urls);
  const successfullySubmitted = MutableList.make<string>();

  yield* Effect.logInfo(`Submitting ${urls.length} URLs to IndexNow...`);

  const walk = yield* Effect.forEach(
    batches,
    (batch, index) =>
      Effect.gen(function* () {
        MutableList.appendAll(
          successfullySubmitted,
          yield* submitBatchToIndexNow({
            batch,
            batchCount: index + 1,
            key,
            totalBatches: batches.length,
          })
        );

        if (index < batches.length - 1) {
          yield* Effect.sleep(RATE_LIMIT_DELAY);
        }
      }),
    { discard: true }
  ).pipe(Effect.result);
  if (Result.isFailure(walk)) {
    return {
      failure: Option.some(walk.failure),
      submittedUrls: MutableList.toArray(successfullySubmitted),
    };
  }

  yield* Effect.logInfo(
    `IndexNow submission completed. Successfully submitted ${successfullySubmitted.length}/${urls.length} URLs.`
  );

  return {
    failure: Option.none(),
    submittedUrls: MutableList.toArray(successfullySubmitted),
  };
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

  // A 202 means IndexNow received the URLs and validates the key afterwards.
  if (status === HTTP_STATUS_CODE_ACCEPTED) {
    yield* Effect.logInfo(
      `Batch ${batchCount} received with HTTP 202. IndexNow key validation is pending.`
    );
    return [...batch];
  }

  if (status !== HTTP_STATUS_CODE_OK) {
    return yield* new IndexNowSubmitError({
      cause: status,
      message: `IndexNow batch ${batchCount} failed with HTTP ${status}.`,
    });
  }

  yield* Effect.logInfo(`Batch ${batchCount} completed (${batch.length} URLs)`);
  return [...batch];
});
