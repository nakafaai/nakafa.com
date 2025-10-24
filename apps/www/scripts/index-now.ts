// Environment variables loaded via Node.js --env-file flag
import fs from "node:fs";
import path from "node:path";
import {
  baseRoutes,
  getAskRoutes,
  getContentRoutes,
  getEntries,
  getOgRoutes,
  getQuranRoutes,
} from "../app/sitemap";
import { logger } from "./utils";

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
const DATA_FOLDER = path.join(__dirname, "_data");
const SUBMISSION_HISTORY_FILE = path.join(
  DATA_FOLDER,
  "submission-history.json",
);

// Ensure data folder exists
if (!fs.existsSync(DATA_FOLDER)) {
  fs.mkdirSync(DATA_FOLDER, { recursive: true });
  logger.info(`Created data folder at: ${DATA_FOLDER}`);
}

// Regex patterns
const QUOTA_REMAINING_REGEX = /Quota remaining for today: (\d+)/;
const QUOTA_EXCEEDED_REGEX = /exceeded your daily url submission quota/i;

// Load submission history
function loadSubmissionHistory(): {
  indexNow: Record<string, string>;
  bing: Record<string, string>;
} {
  try {
    if (fs.existsSync(SUBMISSION_HISTORY_FILE)) {
      const data = fs.readFileSync(SUBMISSION_HISTORY_FILE, "utf8");
      const parsed = JSON.parse(data);

      // Handle conversion from old format to new format
      if (!(parsed.indexNow || parsed.bing)) {
        // Old format detected - convert to new format
        return {
          indexNow: parsed || {},
          bing: {},
        };
      }

      return parsed;
    }
  } catch (error) {
    logger.warn(
      `Error loading submission history: ${error}. Starting with empty history.`,
    );
  }
  return { indexNow: {}, bing: {} };
}

// Save submission history
function saveSubmissionHistory(history: {
  indexNow: Record<string, string>;
  bing: Record<string, string>;
}): void {
  try {
    fs.writeFileSync(
      SUBMISSION_HISTORY_FILE,
      JSON.stringify(history, null, 2),
      "utf8",
    );
  } catch (error) {
    logger.error(`Error saving submission history: ${error}`);
  }
}

// Get all URLs from the sitemap that haven't been submitted yet
async function getUnsubmittedUrls(service: "indexNow" | "bing"): Promise<{
  urls: string[];
  history: { indexNow: Record<string, string>; bing: Record<string, string> };
}> {
  // Load existing submission history
  const history = loadSubmissionHistory();

  // Get all URLs from sitemap
  const routes = getContentRoutes();
  const ogRoutes = getOgRoutes(routes);
  const quranRoutes = getQuranRoutes();
  const askRoutes = getAskRoutes();

  const allRoutes = [
    ...baseRoutes,
    ...routes,
    ...ogRoutes,
    ...quranRoutes,
    ...askRoutes,
  ];

  // Get all entries asynchronously
  const allEntriesPromises = allRoutes.map((route) => getEntries(route));
  const allEntriesArrays = await Promise.all(allEntriesPromises);
  const allEntries = allEntriesArrays.flat();

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
    Object.keys(history[service]).length,
  );
  logger.stats(`New URLs to submit to ${service}`, urls.length);

  return { urls, history };
}

// Update submission history with successfully submitted URLs
function updateSubmissionHistory(
  history: { indexNow: Record<string, string>; bing: Record<string, string> },
  urls: string[],
  service: "indexNow" | "bing",
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
async function submitBatchToIndexNow(
  batch: string[],
  key: string,
  batchCount: number,
  totalBatches: number,
): Promise<string[]> {
  const apiEndpoint = "https://api.indexnow.org";

  logger.progress(
    batchCount,
    totalBatches,
    `Submitting batch ${batchCount} of ${totalBatches}`,
  );

  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      host: new URL(host).hostname,
      key,
      keyLocation,
      urlList: batch,
    }),
  });

  const status = response.status;

  if (status !== HTTP_STATUS_CODE_OK) {
    logger.error(`Batch ${batchCount} failed with status: ${status}`);
    return [];
  }
  logger.success(`Batch ${batchCount} completed (${batch.length} URLs)`);
  return batch;
}

// Submit URLs to IndexNow
async function submitUrlsToIndexNow(
  urls: string[],
  key: string,
): Promise<string[]> {
  if (urls.length === 0) {
    logger.info("No new URLs to submit to IndexNow.");
    return [];
  }

  // Split URLs into batches of 100
  const batchSize = BATCH_SIZE;
  const batches: string[][] = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }

  logger.info(`Submitting ${urls.length} URLs to IndexNow...`);

  const successfullySubmitted: string[] = [];
  const totalBatches = batches.length;

  // Process batches sequentially using reduce
  await batches.reduce(async (previousPromise, batch, index) => {
    await previousPromise;

    try {
      const batchResult = await submitBatchToIndexNow(
        batch,
        key,
        index + 1,
        totalBatches,
      );
      successfullySubmitted.push(...batchResult);

      // Avoid rate limiting
      if (index < totalBatches - 1) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
    } catch (error) {
      logger.error(`Error submitting batch ${index + 1}: ${error}`);
    }
  }, Promise.resolve());

  logger.info(
    `IndexNow submission completed. Successfully submitted ${successfullySubmitted.length}/${urls.length} URLs.`,
  );

  return successfullySubmitted;
}

// Helper function to extract quota from error message
function extractRemainingQuota(responseText: string): number | null {
  try {
    const errorData = JSON.parse(responseText);
    const quotaMessage = errorData.Message;

    const remainingQuotaMatch = quotaMessage.match(QUOTA_REMAINING_REGEX);
    if (remainingQuotaMatch?.[1]) {
      const remainingQuota = Number.parseInt(remainingQuotaMatch[1], 10);
      if (!Number.isNaN(remainingQuota) && remainingQuota > 0) {
        return remainingQuota;
      }
    }
  } catch (parseError) {
    logger.error(`Error parsing quota information: ${parseError}`);
  }
  return null;
}

// Helper function to process API response
async function processBingResponse(
  response: Response,
  batch: string[],
): Promise<{
  success: boolean;
  quotaRemaining: number | null;
  shouldBreak: boolean;
}> {
  const status = response.status;
  const responseText = await response.text();

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
      const quotaRemaining = extractRemainingQuota(responseText);
      if (quotaRemaining) {
        logger.info(
          `Adjusting batch size to respect quota. New batch size: ${quotaRemaining}`,
        );
        return { success: false, quotaRemaining, shouldBreak: false };
      }
    }

    return { success: false, quotaRemaining: null, shouldBreak: false };
  }

  logger.success(
    `Successfully submitted ${batch.length} URLs to Bing URL Submission API.`,
  );
  return { success: true, quotaRemaining: null, shouldBreak: false };
}

// Helper function to submit a single batch to Bing
async function submitBatchToBing(
  batch: string[],
  apiKey: string,
  startIdx: number,
  endIdx: number,
): Promise<{
  success: boolean;
  urls: string[];
  quotaRemaining?: number;
  shouldBreak?: boolean;
}> {
  const apiEndpoint =
    "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch";

  logger.info(
    `Submitting batch of ${batch.length} URLs to Bing (${startIdx} to ${endIdx})`,
  );

  const response = await fetch(`${apiEndpoint}?apikey=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Host: "ssl.bing.com",
    },
    body: JSON.stringify({
      siteUrl: host,
      urlList: batch,
    }),
  });

  const result = await processBingResponse(response, batch);

  return {
    success: result.success,
    urls: result.success ? batch : [],
    quotaRemaining: result.quotaRemaining ?? undefined,
    shouldBreak: result.shouldBreak,
  };
}

// Submit URLs to Bing URL Submission API
async function submitUrlsToBing(
  urls: string[],
  apiKey: string,
): Promise<string[]> {
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

  // Process URLs in batches using async iteration
  async function processBatch(): Promise<boolean> {
    if (submitted >= urls.length) {
      return false;
    }

    // Calculate how many URLs to submit in this batch
    const currentBatchSize = Math.min(batchSize, urls.length - submitted);
    const batch = urls.slice(submitted, submitted + currentBatchSize);
    const startIdx = submitted + 1;
    const endIdx = submitted + batch.length;

    try {
      const result = await submitBatchToBing(batch, apiKey, startIdx, endIdx);

      if (result.shouldBreak) {
        return false;
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
              `Retrying with smaller batch size of ${result.quotaRemaining}`,
            );
            return true; // Continue processing
          }
        }

        // Increment retry count on error and exit if max retries reached
        retryCount++;
        if (retryCount >= MAX_RETRIES) {
          logger.warn(
            `Maximum retries (${MAX_RETRIES}) reached. Stopping submission.`,
          );
          return false;
        }
      }

      // Avoid rate limiting with a delay between batches
      if (submitted < urls.length) {
        logger.progress(submitted, urls.length, "Submission progress");
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_DELAY));
      }
      return true;
    } catch (error) {
      logger.error(`Error submitting URLs to Bing: ${error}`);
      // Increment retry count and exit if max retries reached
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        logger.warn(
          `Maximum retries (${MAX_RETRIES}) reached. Stopping submission.`,
        );
        return false;
      }
      return true;
    }
  }

  // Use tail recursion to avoid await in loop
  async function processAllBatches(): Promise<void> {
    const shouldContinue = await processBatch();
    if (shouldContinue && submitted < urls.length) {
      await processAllBatches();
    }
  }

  await processAllBatches();

  logger.info(
    `Bing URL Submission API process completed. Submitted ${submitted}/${urls.length} URLs.`,
  );

  return successfullySubmitted;
}

// Main function to run the indexing process
async function runIndexNow(): Promise<void> {
  logger.header("Starting URL Submission Process");

  // Get API key
  const apiKey = getApiKey();
  logger.stats("Using IndexNow key", apiKey);
  logger.stats("Key file location", keyLocation);
  logger.stats("Website URL", host);
  logger.stats("Host URL", new URL(host).hostname);

  // ========== INDEXNOW SUBMISSION ==========
  logger.header("IndexNow Submission");

  // Get unsubmitted URLs for IndexNow
  const indexNowData = await getUnsubmittedUrls("indexNow");

  if (indexNowData.urls.length === 0) {
    logger.info(
      "No new URLs to submit to IndexNow. All URLs have been previously submitted.",
    );
  } else {
    // Submit URLs to IndexNow
    const indexNowSuccessful = await submitUrlsToIndexNow(
      indexNowData.urls,
      apiKey,
    );
    logger.success("IndexNow submission completed.");

    // Record IndexNow submissions to save progress
    if (indexNowSuccessful.length > 0) {
      const updatedHistory = updateSubmissionHistory(
        indexNowData.history,
        indexNowSuccessful,
        "indexNow",
      );
      saveSubmissionHistory(updatedHistory);
      logger.success(
        `Submission history updated for IndexNow with ${indexNowSuccessful.length} successfully submitted URLs.`,
      );
    }
  }

  // ========== BING SUBMISSION ==========
  logger.header("Bing URL Submission API");

  // Check if Bing API key is configured
  if (
    process.env.BING_WEBMASTER_API_KEY &&
    process.env.BING_WEBMASTER_API_KEY !== "YOUR_BING_WEBMASTER_API_KEY"
  ) {
    const bingApiKey = process.env.BING_WEBMASTER_API_KEY;

    // Get unsubmitted URLs for Bing
    const bingData = await getUnsubmittedUrls("bing");

    if (bingData.urls.length === 0) {
      logger.info(
        "No new URLs to submit to Bing. All URLs have been previously submitted.",
      );
    } else {
      // Submit URLs to Bing URL Submission API
      const bingSuccessful = await submitUrlsToBing(bingData.urls, bingApiKey);

      if (bingSuccessful.length > 0) {
        // Update submission history for Bing successful submissions
        const updatedHistory = updateSubmissionHistory(
          bingData.history,
          bingSuccessful,
          "bing",
        );
        saveSubmissionHistory(updatedHistory);
        logger.success(
          `Submission history updated for Bing with ${bingSuccessful.length} successfully submitted URLs.`,
        );
      }
    }
  } else {
    logger.warn(
      "Bing Webmaster API key not configured. Skipping Bing URL Submission.",
    );
    logger.info(
      "To enable Bing URL Submission, add your Bing Webmaster API key to the .env file as BING_WEBMASTER_API_KEY=your_key",
    );
  }

  logger.header("Submission Process Completed");
}

// Run the script
runIndexNow().catch((error) => {
  logger.error(`Error running script: ${error}`);
  process.exit(1);
});
