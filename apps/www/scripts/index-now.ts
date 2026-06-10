// Environment variables loaded via Node.js --env-file flag
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Config, Effect, Option, Schema } from "effect";
import { getSitemapEntries } from "@/lib/sitemap/entries";
import { logger } from "@/scripts/utils";

const BATCH_SIZE = 100;
const MAX_RETRIES = 2;
const RATE_LIMIT_DELAY = 1000;

const HTTP_STATUS_CODE_OK = 200;

// References:
// - https://www.bing.com/indexnow/getstarted
// - https://www.bing.com/webmasters/url-submission-api#APIs

// Configuration
const host = "https://nakafa.com";
const keyFileName = "e22d548f7fd2482a9022e3b84e944901.txt";
const keyLocation = `${host}/${keyFileName}`;
const hardcodedKey = "e22d548f7fd2482a9022e3b84e944901";

// Data folder and file paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FOLDER = path.join(__dirname, "_data");
const SUBMISSION_HISTORY_FILE = path.join(
  DATA_FOLDER,
  "submission-history.json"
);

// Regex patterns
const QUOTA_REMAINING_REGEX = /Quota remaining for today: (\d+)/;
const QUOTA_EXCEEDED_REGEX = /exceeded your daily url submission quota/i;

const ServiceHistorySchema = Schema.Record({
  key: Schema.String,
  value: Schema.String,
});
const SubmissionHistorySchema = Schema.Struct({
  bing: ServiceHistorySchema,
  indexNow: ServiceHistorySchema,
});
const BingQuotaMessageSchema = Schema.Struct({
  Message: Schema.String,
});

/** Expected failure while creating the URL submission data folder. */
class SubmissionDataFolderError extends Schema.TaggedError<SubmissionDataFolderError>()(
  "SubmissionDataFolderError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure while submitting one IndexNow batch. */
class IndexNowBatchSubmitError extends Schema.TaggedError<IndexNowBatchSubmitError>()(
  "IndexNowBatchSubmitError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

/** Expected failure while submitting one Bing batch. */
class BingBatchSubmitError extends Schema.TaggedError<BingBatchSubmitError>()(
  "BingBatchSubmitError",
  {
    cause: Schema.Unknown,
    message: Schema.String,
  }
) {}

const decodeSubmissionHistoryJson = Schema.decodeUnknown(
  Schema.parseJson(Schema.Unknown)
);
const decodeSubmissionHistory = Schema.decodeUnknown(SubmissionHistorySchema);
const decodeEmptySubmissionHistory = Schema.decodeUnknown(
  SubmissionHistorySchema
);
const decodeBingQuotaMessage = Schema.decodeUnknown(
  Schema.parseJson(BingQuotaMessageSchema)
);
const bingWebmasterApiKey = Config.string("BING_WEBMASTER_API_KEY").pipe(
  Config.option
);

/** Builds the empty submission-history shape used when no history file exists. */
function emptySubmissionHistory() {
  return {
    bing: {},
    indexNow: {},
  };
}

/** Ensures the local submission-history data folder exists. */
const ensureSubmissionDataFolder = Effect.fn(
  "scripts.indexNow.ensureDataFolder"
)(function* () {
  const exists = yield* Effect.try({
    try: () => fs.existsSync(DATA_FOLDER),
    catch: (cause) =>
      new SubmissionDataFolderError({
        cause,
        message: `Failed to inspect ${DATA_FOLDER}.`,
      }),
  });

  if (exists) {
    return;
  }

  yield* Effect.try({
    try: () => {
      fs.mkdirSync(DATA_FOLDER, { recursive: true });
      logger.info(`Created data folder at: ${DATA_FOLDER}`);
    },
    catch: (cause) =>
      new SubmissionDataFolderError({
        cause,
        message: `Failed to create ${DATA_FOLDER}.`,
      }),
  });
});

/** Loads the submission-history file used by IndexNow and Bing submissions. */
const loadSubmissionHistory = Effect.fn(
  "scripts.indexNow.loadSubmissionHistory"
)(function* () {
  const exists = yield* Effect.try({
    try: () => fs.existsSync(SUBMISSION_HISTORY_FILE),
    catch: (error) => error,
  });

  if (!exists) {
    return yield* decodeEmptySubmissionHistory(emptySubmissionHistory());
  }

  const data = yield* Effect.try({
    try: () => fs.readFileSync(SUBMISSION_HISTORY_FILE, "utf8"),
    catch: (error) => error,
  });
  const parsed = yield* decodeSubmissionHistoryJson(data);

  return yield* decodeSubmissionHistory(parsed);
});

/** Persists submission history without masking the rest of the script. */
const saveSubmissionHistory = Effect.fn(
  "scripts.indexNow.saveSubmissionHistory"
)(function* (history: {
  indexNow: Record<string, string>;
  bing: Record<string, string>;
}) {
  yield* Effect.try({
    try: () => {
      fs.writeFileSync(
        SUBMISSION_HISTORY_FILE,
        JSON.stringify(history, null, 2),
        "utf8"
      );
    },
    catch: (error) => error,
  }).pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        logger.error(`Error saving submission history: ${error}`);
      })
    )
  );
});

/** Gets all sitemap URLs that have not been submitted to the target service. */
const getUnsubmittedUrls = Effect.fn("scripts.indexNow.getUnsubmittedUrls")(
  function* (service: "indexNow" | "bing") {
    // Load existing submission history
    const history = yield* loadSubmissionHistory().pipe(
      Effect.catchAll((error) =>
        Effect.gen(function* () {
          yield* Effect.sync(() => {
            logger.warn(
              `Error loading submission history: ${error}. Starting with empty history.`
            );
          });
          return yield* decodeEmptySubmissionHistory(emptySubmissionHistory());
        })
      )
    );

    const allEntries = yield* getSitemapEntries();

    // Extract unique URLs
    const allUrls = new Set<string>();
    for (const entry of allEntries) {
      allUrls.add(entry.url);
    }

    // Filter out already submitted URLs for the specific service
    const urls = Array.from(allUrls).filter((url) => !history[service][url]);

    logger.stats("Total URLs in sitemap", allUrls.size);
    logger.stats(
      `Previously submitted URLs to ${service}`,
      Object.keys(history[service]).length
    );
    logger.stats(`New URLs to submit to ${service}`, urls.length);

    return { history, urls };
  }
);

// Update submission history with successfully submitted URLs
function updateSubmissionHistory(
  history: { indexNow: Record<string, string>; bing: Record<string, string> },
  urls: string[],
  service: "indexNow" | "bing"
): { indexNow: Record<string, string>; bing: Record<string, string> } {
  const timestamp = new Date().toISOString();
  for (const url of urls) {
    history[service][url] = timestamp;
  }
  return history;
}

// Get API key - using hardcoded key instead of generating a new one
function getApiKey(): string {
  return hardcodedKey;
}

// Helper function to submit a single batch to IndexNow
const submitBatchToIndexNow = Effect.fn("scripts.indexNow.submitIndexNowBatch")(
  function* (
    batch: string[],
    key: string,
    batchCount: number,
    totalBatches: number
  ) {
    yield* Effect.sync(() => {
      logger.progress(
        batchCount,
        totalBatches,
        `Submitting batch ${batchCount} of ${totalBatches}`
      );
    });

    const status = yield* Effect.tryPromise({
      try: () =>
        fetch("https://api.indexnow.org", {
          body: JSON.stringify({
            host: new URL(host).hostname,
            key,
            keyLocation,
            urlList: batch,
          }),
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          method: "POST",
        }).then((response) => response.status),
      catch: (cause) =>
        new IndexNowBatchSubmitError({
          cause,
          message: `Error submitting IndexNow batch ${batchCount}.`,
        }),
    }).pipe(
      Effect.catchTag("IndexNowBatchSubmitError", (error) =>
        Effect.sync(() => {
          logger.error(`${error.message}: ${error.cause}`);
          return 0;
        })
      )
    );

    if (status !== HTTP_STATUS_CODE_OK) {
      logger.error(`Batch ${batchCount} failed with status: ${status}`);
      return [];
    }

    logger.success(`Batch ${batchCount} completed (${batch.length} URLs)`);
    return batch;
  }
);

// Submit URLs to IndexNow
const submitUrlsToIndexNow = Effect.fn("scripts.indexNow.submitIndexNowUrls")(
  function* (urls: string[], key: string) {
    if (urls.length === 0) {
      logger.info("No new URLs to submit to IndexNow.");
      return [];
    }

    // Split URLs into batches of 100
    const batches: string[][] = [];
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
      batches.push(urls.slice(i, i + BATCH_SIZE));
    }

    logger.info(`Submitting ${urls.length} URLs to IndexNow...`);

    const successfullySubmitted: string[] = [];
    const totalBatches = batches.length;

    for (let index = 0; index < batches.length; index += 1) {
      const batch = batches[index];
      const batchResult = yield* submitBatchToIndexNow(
        batch,
        key,
        index + 1,
        totalBatches
      );
      successfullySubmitted.push(...batchResult);

      // Avoid rate limiting
      if (index < totalBatches - 1) {
        yield* Effect.sleep(RATE_LIMIT_DELAY);
      }
    }

    logger.info(
      `IndexNow submission completed. Successfully submitted ${successfullySubmitted.length}/${urls.length} URLs.`
    );

    return successfullySubmitted;
  }
);

// Helper function to extract quota from error message
const extractRemainingQuota = Effect.fn("scripts.indexNow.extractBingQuota")(
  function* (responseText: string) {
    const errorData = yield* decodeBingQuotaMessage(responseText).pipe(
      Effect.catchAll((error) =>
        Effect.sync(() => {
          logger.error(`Error parsing quota information: ${error}`);
          return { Message: "" };
        })
      )
    );

    const remainingQuotaMatch = errorData.Message.match(QUOTA_REMAINING_REGEX);
    if (!remainingQuotaMatch?.[1]) {
      return null;
    }

    const remainingQuota = Number.parseInt(remainingQuotaMatch[1], 10);
    if (Number.isNaN(remainingQuota) || remainingQuota <= 0) {
      return null;
    }

    return remainingQuota;
  }
);

// Helper function to process API response
const processBingResponse = Effect.fn("scripts.indexNow.processBingResponse")(
  function* (response: Response, batch: string[]) {
    const status = response.status;
    const responseText = yield* Effect.tryPromise({
      try: () => response.text(),
      catch: (cause) =>
        new BingBatchSubmitError({
          cause,
          message: "Failed to read Bing response text.",
        }),
    });

    logger.info(`Bing API response status: ${status}`);

    if (status !== HTTP_STATUS_CODE_OK) {
      logger.error(`Error submitting URLs to Bing. Status: ${status}`);
      logger.error(`Response: ${responseText}`);

      // Check for quota exceeded error
      if (QUOTA_EXCEEDED_REGEX.test(responseText)) {
        logger.warn("Daily quota exceeded. Stopping submission.");
        return { success: false, quotaRemaining: null, shouldBreak: true };
      }

      // Check if the error is related to quota limitations
      if (responseText.includes("Quota remaining")) {
        const quotaRemaining = yield* extractRemainingQuota(responseText);
        if (quotaRemaining) {
          logger.info(
            `Adjusting batch size to respect quota. New batch size: ${quotaRemaining}`
          );
          return { success: false, quotaRemaining, shouldBreak: false };
        }
      }

      return { success: false, quotaRemaining: null, shouldBreak: false };
    }

    logger.success(
      `Successfully submitted ${batch.length} URLs to Bing URL Submission API.`
    );
    return { success: true, quotaRemaining: null, shouldBreak: false };
  }
);

// Helper function to submit a single batch to Bing
const submitBatchToBing = Effect.fn("scripts.indexNow.submitBingBatch")(
  function* (
    batch: string[],
    apiKey: string,
    startIdx: number,
    endIdx: number
  ) {
    const apiEndpoint =
      "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch";

    logger.info(
      `Submitting batch of ${batch.length} URLs to Bing (${startIdx} to ${endIdx})`
    );

    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(`${apiEndpoint}?apikey=${apiKey}`, {
          body: JSON.stringify({
            siteUrl: host,
            urlList: batch,
          }),
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            Host: "ssl.bing.com",
          },
          method: "POST",
        }),
      catch: (cause) =>
        new BingBatchSubmitError({
          cause,
          message: "Error submitting URLs to Bing.",
        }),
    });

    const result = yield* processBingResponse(response, batch);

    return {
      success: result.success,
      urls: result.success ? batch : [],
      quotaRemaining: result.quotaRemaining ?? undefined,
      shouldBreak: result.shouldBreak,
    };
  }
);

// Submit URLs to Bing URL Submission API
const submitUrlsToBing = Effect.fn("scripts.indexNow.submitBingUrls")(
  function* (urls: string[], apiKey: string) {
    if (urls.length === 0) {
      logger.info("No new URLs to submit to Bing.");
      return [];
    }

    // Set a safer default batch size to respect Bing's quota
    let batchSize = BATCH_SIZE; // Reduced from 500 to 100 to stay within quota

    logger.info("Starting Bing URL Submission API process...");
    logger.stats("URLs to submit", urls.length);
    logger.stats("Initial batch size", batchSize);

    let submitted = 0;
    let retryCount = 0;
    const successfullySubmitted: string[] = [];

    while (submitted < urls.length) {
      // Calculate how many URLs to submit in this batch
      const currentBatchSize = Math.min(batchSize, urls.length - submitted);
      const batch = urls.slice(submitted, submitted + currentBatchSize);
      const startIdx = submitted + 1;
      const endIdx = submitted + batch.length;

      const result = yield* submitBatchToBing(
        batch,
        apiKey,
        startIdx,
        endIdx
      ).pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => {
            logger.error(`Error submitting URLs to Bing: ${error}`);
            retryCount += 1;
            return {
              quotaRemaining: undefined,
              shouldBreak: retryCount >= MAX_RETRIES,
              success: false,
              urls: [],
            };
          })
        )
      );

      if (result.shouldBreak) {
        if (retryCount >= MAX_RETRIES) {
          logger.warn(
            `Maximum retries (${MAX_RETRIES}) reached. Stopping submission.`
          );
        }
        break;
      }

      if (result.success) {
        // Track successfully submitted URLs
        successfullySubmitted.push(...result.urls);
        // Increment submitted count only on success
        submitted += batch.length;
        // Reset retry counter on success
        retryCount = 0;
      } else {
        // Check if we have a new quota limit
        if (result.quotaRemaining) {
          batchSize = result.quotaRemaining;
          // If the batch was too large, retry with the smaller batch size
          if (batch.length > result.quotaRemaining) {
            logger.info(
              `Retrying with smaller batch size of ${result.quotaRemaining}`
            );
            continue;
          }
        }

        // Increment retry count on error and exit if max retries reached
        retryCount += 1;
        if (retryCount >= MAX_RETRIES) {
          logger.warn(
            `Maximum retries (${MAX_RETRIES}) reached. Stopping submission.`
          );
          break;
        }
      }

      // Avoid rate limiting with a delay between batches
      if (submitted < urls.length) {
        logger.progress(submitted, urls.length, "Submission progress");
        yield* Effect.sleep(RATE_LIMIT_DELAY);
      }
    }

    logger.info(
      `Bing URL Submission API process completed. Submitted ${submitted}/${urls.length} URLs.`
    );

    return successfullySubmitted;
  }
);

// Main function to run the indexing process
const runIndexNow = Effect.fn("scripts.indexNow.run")(function* () {
  logger.header("Starting URL Submission Process");
  yield* ensureSubmissionDataFolder();

  // Get API key
  const apiKey = getApiKey();
  logger.stats("Using IndexNow key", apiKey);
  logger.stats("Key file location", keyLocation);
  logger.stats("Website URL", host);
  logger.stats("Host URL", new URL(host).hostname);

  // ========== INDEXNOW SUBMISSION ==========
  logger.header("IndexNow Submission");

  // Get unsubmitted URLs for IndexNow
  const indexNowData = yield* getUnsubmittedUrls("indexNow");

  if (indexNowData.urls.length === 0) {
    logger.info(
      "No new URLs to submit to IndexNow. All URLs have been previously submitted."
    );
  } else {
    // Submit URLs to IndexNow
    const indexNowSuccessful = yield* submitUrlsToIndexNow(
      indexNowData.urls,
      apiKey
    );
    logger.success("IndexNow submission completed.");

    // Record IndexNow submissions to save progress
    if (indexNowSuccessful.length > 0) {
      const updatedHistory = updateSubmissionHistory(
        indexNowData.history,
        indexNowSuccessful,
        "indexNow"
      );
      yield* saveSubmissionHistory(updatedHistory);
      logger.success(
        `Submission history updated for IndexNow with ${indexNowSuccessful.length} successfully submitted URLs.`
      );
    }
  }

  // ========== BING SUBMISSION ==========
  logger.header("Bing URL Submission API");

  // Check if Bing API key is configured
  const bingApiKey = yield* bingWebmasterApiKey;

  if (
    Option.isSome(bingApiKey) &&
    bingApiKey.value !== "YOUR_BING_WEBMASTER_API_KEY"
  ) {
    // Get unsubmitted URLs for Bing
    const bingData = yield* getUnsubmittedUrls("bing");

    if (bingData.urls.length === 0) {
      logger.info(
        "No new URLs to submit to Bing. All URLs have been previously submitted."
      );
    } else {
      // Submit URLs to Bing URL Submission API
      const bingSuccessful = yield* submitUrlsToBing(
        bingData.urls,
        bingApiKey.value
      );

      if (bingSuccessful.length > 0) {
        // Update submission history for Bing successful submissions
        const updatedHistory = updateSubmissionHistory(
          bingData.history,
          bingSuccessful,
          "bing"
        );
        yield* saveSubmissionHistory(updatedHistory);
        logger.success(
          `Submission history updated for Bing with ${bingSuccessful.length} successfully submitted URLs.`
        );
      }
    }
  } else {
    logger.warn(
      "Bing Webmaster API key not configured. Skipping Bing URL Submission."
    );
    logger.info(
      "To enable Bing URL Submission, add your Bing Webmaster API key to the .env file as BING_WEBMASTER_API_KEY=your_key"
    );
  }

  logger.header("Submission Process Completed");
});

// Run the script
Effect.runPromise(
  runIndexNow().pipe(
    Effect.catchAll((error) =>
      Effect.sync(() => {
        logger.error(`Error running script: ${error}`);
        process.exit(1);
      })
    )
  )
);
