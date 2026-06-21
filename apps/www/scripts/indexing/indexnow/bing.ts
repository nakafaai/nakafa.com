import { Config, Effect, Option, Schema } from "effect";
import { BingSubmitError } from "@/scripts/indexing/errors";
import { INDEXING_HOST } from "@/scripts/indexing/paths";
import { logger } from "@/scripts/utils";

const BATCH_SIZE = 100;
const RATE_LIMIT_DELAY = 1000;
const HTTP_STATUS_CODE_OK = 200;
const BING_SUBMIT_ENDPOINT =
  "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch";
const BING_PLACEHOLDER_API_KEY = "YOUR_BING_WEBMASTER_API_KEY";
const QUOTA_REMAINING_REGEX = /Quota remaining for today: (\d+)/u;
const QUOTA_EXCEEDED_REGEX = /exceeded your daily url submission quota/iu;

const BingQuotaMessageSchema = Schema.Struct({
  Message: Schema.String,
});
const decodeBingQuotaMessage = Schema.decodeUnknown(
  Schema.parseJson(BingQuotaMessageSchema)
);
const bingWebmasterApiKey = Config.string("BING_WEBMASTER_API_KEY").pipe(
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
 * when the endpoint reports the daily quota has already been exhausted.
 */
export const submitUrlsToBing = Effect.fn("scripts.indexing.bing.submitUrls")(
  function* (urls: readonly string[], apiKey: string) {
    if (urls.length === 0) {
      logger.info("No new URLs to submit to Bing.");
      return [];
    }

    let batchSize = BATCH_SIZE;
    let submittedCount = 0;
    const successfullySubmitted: string[] = [];

    logger.info("Starting Bing URL Submission API process...");
    logger.stats("URLs to submit", urls.length);
    logger.stats("Initial batch size", batchSize);

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
      const result = yield* submitBatchToBing({
        apiKey,
        batch,
        endIndex,
        startIndex,
      });

      if (result.submittedUrls.length > 0) {
        successfullySubmitted.push(...result.submittedUrls);
        submittedCount += result.submittedUrls.length;
      }

      if (result.shouldStop) {
        break;
      }

      if (result.quotaRemaining !== undefined) {
        batchSize = result.quotaRemaining;

        if (batch.length > result.quotaRemaining) {
          logger.info(
            `Retrying with smaller batch size of ${result.quotaRemaining}`
          );
          continue;
        }
      }

      if (result.submittedUrls.length === 0) {
        break;
      }

      if (submittedCount < urls.length) {
        logger.progress(submittedCount, urls.length, "Submission progress");
        yield* Effect.sleep(RATE_LIMIT_DELAY);
      }
    }

    logger.info(
      `Bing URL Submission API process completed. Submitted ${successfullySubmitted.length}/${urls.length} URLs.`
    );

    return successfullySubmitted;
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
    logger.info(
      `Submitting batch of ${batch.length} URLs to Bing (${startIndex} to ${endIndex})`
    );

    const response = yield* Effect.tryPromise({
      catch: (cause) =>
        new BingSubmitError({
          cause,
          message: "Error submitting URLs to Bing.",
        }),
      try: () =>
        fetch(`${BING_SUBMIT_ENDPOINT}?apikey=${apiKey}`, {
          body: JSON.stringify({
            siteUrl: INDEXING_HOST,
            urlList: batch,
          }),
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Host: "ssl.bing.com",
          },
          method: "POST",
        }),
    });

    return yield* readBingResponse(response, batch);
  }
);

/** Reads Bing's response and preserves quota semantics for the submit loop. */
const readBingResponse = Effect.fn("scripts.indexing.bing.readResponse")(
  function* (response: Response, batch: readonly string[]) {
    const status = response.status;
    const responseText = yield* Effect.tryPromise({
      catch: (cause) =>
        new BingSubmitError({
          cause,
          message: "Failed to read Bing response text.",
        }),
      try: () => response.text(),
    });

    logger.info(`Bing API response status: ${status}`);

    if (status === HTTP_STATUS_CODE_OK) {
      logger.success(
        `Successfully submitted ${batch.length} URLs to Bing URL Submission API.`
      );
      return {
        quotaRemaining: undefined,
        shouldStop: false,
        submittedUrls: [...batch],
      };
    }

    logger.error(`Error submitting URLs to Bing. Status: ${status}`);
    logger.error(`Response: ${responseText}`);

    if (QUOTA_EXCEEDED_REGEX.test(responseText)) {
      logger.warn("Daily quota exceeded. Stopping submission.");
      return {
        quotaRemaining: undefined,
        shouldStop: true,
        submittedUrls: [],
      };
    }

    if (responseText.includes("Quota remaining")) {
      const quotaRemaining = yield* readRemainingBingQuota(responseText);

      if (quotaRemaining !== undefined) {
        logger.info(
          `Adjusting batch size to respect quota. New batch size: ${quotaRemaining}`
        );
        return {
          quotaRemaining,
          shouldStop: false,
          submittedUrls: [],
        };
      }
    }

    return {
      quotaRemaining: undefined,
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

    if (Number.isNaN(remainingQuota) || remainingQuota <= 0) {
      return;
    }

    return remainingQuota;
  }
);
