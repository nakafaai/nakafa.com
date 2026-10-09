import { NETWORK_ATTEMPT_DEADLINE } from "@repo/backend/client/network";
import { Config, Effect, MutableList, Option, Result, Schema } from "effect";
import { HttpBody, HttpClient } from "effect/http";
import { BingSubmitError } from "@/scripts/indexing/errors";
import { INDEXING_HOST } from "@/scripts/indexing/paths";

const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY = 1000;
const HTTP_STATUS_CODE_OK = 200;
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const BING_SUBMIT_ENDPOINT =
  "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch";
const BING_PLACEHOLDER_API_KEY = "YOUR_BING_WEBMASTER_API_KEY";
const QUOTA_REMAINING_REGEX = /Quota remaining for today: (\d+)/u;
const QUOTA_EXCEEDED_REGEX = /exceeded your daily url submission quota/iu;
const BingQuotaMessageSchema = Schema.Struct({
  Message: Schema.String,
});
const decodeBingQuotaMessage = Schema.decodeUnknownEffect(
  Schema.fromJsonString(BingQuotaMessageSchema)
);
const bingWebmasterApiKey = Config.String("BING_WEBMASTER_API_KEY").pipe(
  Config.option
);
/** Reads the optional Bing Webmaster API key from the CLI environment. */
export const readBingWebmasterApiKey = Effect.fn(
  "scripts.indexing.bing.readApiKey"
)(function* () {
  const apiKey = yield* bingWebmasterApiKey;
  if (Option.isNone(apiKey)) {
    return;
  }
  if (apiKey.value === BING_PLACEHOLDER_API_KEY) {
    return;
  }
  return apiKey.value;
});
/**
 * Submits canonical sitemap URLs to Bing's URL Submission API.
 *
 * The adapter respects Bing quota messages by reducing batch size or stopping
 * when the endpoint reports the daily quota has already been exhausted. It
 * returns the URLs Bing accepted, whether a quota stop ended the call, and,
 * when a batch fails, the typed failure that ended the call. The caller saves
 * the accepted URLs before it fails, and a quota stop is not a failure.
 */
export const submitUrlsToBing = Effect.fn("scripts.indexing.bing.submitUrls")(
  function* (urls: readonly string[], apiKey: string) {
    if (urls.length === 0) {
      yield* Effect.logInfo("No new URLs to submit to Bing.");
      return { failure: Option.none(), stopped: false, submittedUrls: [] };
    }
    let batchSize = BATCH_SIZE;
    let submittedCount = 0;
    let stopped = false;
    const successfullySubmitted = MutableList.make<string>();
    yield* Effect.logInfo("Starting Bing URL Submission API process...");
    yield* Effect.logInfo(`URLs to submit: ${urls.length}`);
    yield* Effect.logInfo(`Initial batch size: ${batchSize}`);
    while (submittedCount < urls.length) {
      const currentBatchSize = Math.min(
        batchSize,
        urls.length - submittedCount
      );
      const batch = urls.slice(
        submittedCount,
        submittedCount + currentBatchSize
      );
      const startIndex = submittedCount + 1;
      const endIndex = submittedCount + batch.length;
      const outcome = yield* submitBatchToBing({
        apiKey,
        batch,
        endIndex,
        startIndex,
      }).pipe(Effect.result);
      if (Result.isFailure(outcome)) {
        return {
          failure: Option.some(outcome.failure),
          stopped: false,
          submittedUrls: MutableList.toArray(successfullySubmitted),
        };
      }
      const result = outcome.success;
      if (result.submittedUrls.length > 0) {
        MutableList.appendAll(successfullySubmitted, result.submittedUrls);
        submittedCount += result.submittedUrls.length;
      }
      if (result.shouldStop) {
        stopped = true;
        break;
      }
      if (result.quotaRemaining !== undefined) {
        batchSize = result.quotaRemaining;
        if (batch.length > result.quotaRemaining) {
          yield* Effect.logInfo(
            `Retrying with smaller batch size of ${result.quotaRemaining}`
          );
          continue;
        }
      }
      // A quota message that allows the refused batch also ends the run quietly.
      if (result.submittedUrls.length === 0) {
        stopped = true;
        break;
      }
      if (submittedCount < urls.length) {
        yield* Effect.logInfo(
          `Submission progress: ${submittedCount}/${urls.length} (${Math.round((submittedCount / urls.length) * 100)}%)`
        );
        yield* Effect.sleep(RATE_LIMIT_DELAY);
      }
    }
    yield* Effect.logInfo(
      `Bing URL Submission API process completed. Submitted ${successfullySubmitted.length}/${urls.length} URLs.`
    );
    return {
      failure: Option.none(),
      stopped,
      submittedUrls: MutableList.toArray(successfullySubmitted),
    };
  }
);
/** Submits one Bing batch and converts quota responses into caller decisions. */
const submitBatchToBing = Effect.fn("scripts.indexing.bing.submitBatch")(
  function* ({
    apiKey,
    batch,
    endIndex,
    startIndex,
  }: {
    apiKey: string;
    batch: readonly string[];
    endIndex: number;
    startIndex: number;
  }) {
    yield* Effect.logInfo(
      `Submitting batch of ${batch.length} URLs to Bing (${startIndex} to ${endIndex})`
    );
    const { responseText, status } = yield* sendBingBatch({
      apiKey,
      batch,
    }).pipe(
      Effect.timeoutOrElse({
        duration: NETWORK_ATTEMPT_DEADLINE,
        orElse: () =>
          Effect.fail(
            new BingSubmitError({
              cause: "deadline",
              message: "Bing did not answer within 10 seconds.",
            })
          ),
      })
    );
    return yield* readBingResponse(status, responseText, batch);
  }
);
/** Sends one Bing batch and reads its body. The caller bounds both with one deadline. */
const sendBingBatch = Effect.fn("scripts.indexing.bing.sendBatch")(function* ({
  apiKey,
  batch,
}: {
  apiKey: string;
  batch: readonly string[];
}) {
  const client = yield* HttpClient.HttpClient;
  const response = yield* client
    .post(BING_SUBMIT_ENDPOINT, {
      body: HttpBody.jsonUnsafe(
        {
          siteUrl: INDEXING_HOST,
          urlList: batch,
        },
        JSON_CONTENT_TYPE
      ),
      headers: { Host: "ssl.bing.com" },
      urlParams: { apikey: apiKey },
    })
    .pipe(
      // Bing requires `apikey` in the query, so its URL must not enter telemetry.
      Effect.provideService(HttpClient.TracerDisabledWhen, () => true),
      Effect.mapError(
        (cause) =>
          new BingSubmitError({
            cause,
            message: "Error submitting URLs to Bing.",
          })
      )
    );
  const responseText = yield* response.text.pipe(
    Effect.mapError(
      (cause) =>
        new BingSubmitError({
          cause,
          message: "Failed to read Bing response text.",
        })
    )
  );
  return { responseText, status: response.status };
});
/** Reads Bing's response and preserves quota semantics for the submit loop. */
const readBingResponse = Effect.fn("scripts.indexing.bing.readResponse")(
  function* (status: number, responseText: string, batch: readonly string[]) {
    yield* Effect.logInfo(`Bing API response status: ${status}`);
    if (status === HTTP_STATUS_CODE_OK) {
      yield* Effect.logInfo(
        `Successfully submitted ${batch.length} URLs to Bing URL Submission API.`
      );
      return {
        quotaRemaining: undefined,
        shouldStop: false,
        submittedUrls: [...batch],
      };
    }
    yield* Effect.logError(`Error submitting URLs to Bing. Status: ${status}`);
    yield* Effect.logError(`Response: ${responseText}`);
    if (QUOTA_EXCEEDED_REGEX.test(responseText)) {
      yield* Effect.logWarning("Daily quota exceeded. Stopping submission.");
      return {
        quotaRemaining: undefined,
        shouldStop: true,
        submittedUrls: [],
      };
    }
    if (!responseText.includes("Quota remaining")) {
      return yield* new BingSubmitError({
        cause: status,
        message: `Bing failed with HTTP ${status}.`,
      });
    }
    const quotaRemaining = yield* readRemainingBingQuota(responseText);
    if (quotaRemaining === undefined) {
      // A quota message without a usable number stops the run quietly.
      return {
        quotaRemaining: undefined,
        shouldStop: true,
        submittedUrls: [],
      };
    }
    yield* Effect.logInfo(
      `Adjusting batch size to respect quota. New batch size: ${quotaRemaining}`
    );
    return {
      quotaRemaining,
      shouldStop: false,
      submittedUrls: [],
    };
  }
);
/** Decodes Bing's JSON quota message and extracts the remaining daily count. */
const readRemainingBingQuota = Effect.fn("scripts.indexing.bing.readQuota")(
  function* (responseText: string) {
    const quotaMessage = yield* decodeBingQuotaMessage(responseText).pipe(
      Effect.mapError(
        (cause) =>
          new BingSubmitError({
            cause,
            message: "Failed to decode Bing quota response.",
          })
      )
    );
    const remainingQuotaMatch = quotaMessage.Message.match(
      QUOTA_REMAINING_REGEX
    );
    if (!remainingQuotaMatch?.[1]) {
      return;
    }
    const remainingQuota = Number.parseInt(remainingQuotaMatch[1], 10);
    if (remainingQuota <= 0) {
      return;
    }
    return remainingQuota;
  }
);
