/**
 * Google Indexing API Script
 *
 * This script submits URLs to Google's Indexing API in batches to notify Google
 * of new or updated content on the website. It maintains a history of submitted
 * URLs to avoid duplicate submissions and respects Google's API rate limits.
 *
 * Features:
 * - Batch processing (max 100 URLs per batch)
 * - Rate limiting with delays between batches
 * - Submission history tracking in google-index.json
 * - Comprehensive error handling and logging
 * - Automatic URL collection from sitemap
 *
 * Usage:
 *   bun run google-index
 *
 * Requirements:
 * - google-key.json file with service account credentials
 * - Service account must have Indexing API permissions
 * - URLs must be from verified Search Console property
 *
 * API Limits:
 * - 200 requests per day per project (default quota)
 * - 100 URLs maximum per batch request
 * - Rate limiting recommended to avoid temporary blocks
 */

// Environment variables loaded via Node.js --env-file flag
import fs from "node:fs";
import path from "node:path";
import { GoogleAuth } from "google-auth-library";
import {
  baseRoutes,
  getAskRoutes,
  getContentRoutes,
  getEntries,
  getOgRoutes,
  getQuranRoutes,
} from "../app/sitemap";
import { logger } from "./utils";

const BATCH_SIZE = 100; // Google's maximum batch size
const RATE_LIMIT_DELAY = 2000; // 2 seconds between batches to be safe
const MAX_BACKOFF_DELAY = 30_000; // 30 seconds maximum backoff
const BACKOFF_MULTIPLIER = 2; // Double the delay on each retry
const BATCH_ITEM_INDEX_OFFSET = 1;
const RADIX_BASE_36 = 36;
const BOUNDARY_SUBSTRING_START = 2;
const PERCENTAGE_MULTIPLIER = 100;
const LOG_RESPONSE_MAX_LENGTH = 500;

const HTTP_STATUS_CODE_OK = 200;
const HTTP_STATUS_CODE_UNAUTHORIZED = 401;
const HTTP_STATUS_CODE_FORBIDDEN = 403;
const HTTP_STATUS_CODE_TOO_MANY_REQUESTS = 429;
const SUCCESS_RATE_THRESHOLD = 50;
const MAX_FAILED_URLS_TO_LOG = 3;

// Regex for parsing HTTP status from multipart responses
const HTTP_STATUS_REGEX = /HTTP\/1\.1 (\d+)/;

// References:
// - https://developers.google.com/search/apis/indexing-api/v3/using-api
// - https://developers.google.com/search/apis/indexing-api/v3/quota-pricing
// - https://developers.google.com/search/apis/indexing-api/v3/prereqs

// Configuration
const host = "https://nakafa.com";

// Data folder and file paths
const DATA_FOLDER = path.join(__dirname, "_data");
const GOOGLE_INDEX_HISTORY_FILE = path.join(DATA_FOLDER, "google-index.json");
const GOOGLE_KEY_FILE = path.join(__dirname, "google-key.json");

// Ensure data folder exists
if (!fs.existsSync(DATA_FOLDER)) {
  fs.mkdirSync(DATA_FOLDER, { recursive: true });
  logger.info(`Created data folder at: ${DATA_FOLDER}`);
}

// Google API configuration
const GOOGLE_INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing";
const GOOGLE_BATCH_ENDPOINT = "https://indexing.googleapis.com/batch";

// Initialize Google Auth client
function initializeGoogleAuth(): GoogleAuth {
  return new GoogleAuth({
    keyFile: GOOGLE_KEY_FILE,
    scopes: [GOOGLE_INDEXING_SCOPE],
  });
}

// Get access token for Google API
async function getGoogleAccessToken(auth: GoogleAuth): Promise<string> {
  try {
    const client = await auth.getClient();
    const accessTokenResponse = await client.getAccessToken();
    const accessToken = accessTokenResponse.token;

    if (!accessToken) {
      throw new Error("Failed to obtain access token");
    }

    return accessToken;
  } catch (error) {
    logger.error(`Error obtaining Google access token: ${error}`);
    throw error;
  }
}

// Load Google indexing history
function loadGoogleIndexHistory(): Record<string, string> {
  try {
    if (fs.existsSync(GOOGLE_INDEX_HISTORY_FILE)) {
      const data = fs.readFileSync(GOOGLE_INDEX_HISTORY_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    logger.warn(
      `Error loading Google index history: ${error}. Starting with empty history.`
    );
  }
  return {};
}

// Save Google indexing history
function saveGoogleIndexHistory(history: Record<string, string>): void {
  try {
    fs.writeFileSync(
      GOOGLE_INDEX_HISTORY_FILE,
      JSON.stringify(history, null, 2),
      "utf8"
    );
  } catch (error) {
    logger.error(`Error saving Google index history: ${error}`);
  }
}

// Get all URLs from the sitemap that haven't been submitted yet
async function getUnsubmittedUrls(): Promise<{
  urls: string[];
  history: Record<string, string>;
}> {
  // Load existing submission history
  const history = loadGoogleIndexHistory();

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

  // Filter out already submitted URLs
  const urls = Array.from(allUrls).filter((url) => !history[url]);

  logger.stats("Total URLs in sitemap", allUrls.size);
  logger.stats(
    "Previously submitted URLs to Google",
    Object.keys(history).length
  );
  logger.stats("New URLs to submit to Google", urls.length);

  return { urls, history };
}

// Update submission history with successfully submitted URLs
function updateGoogleIndexHistory(
  history: Record<string, string>,
  urls: string[]
): Record<string, string> {
  const timestamp = new Date().toISOString();
  for (const url of urls) {
    history[url] = timestamp;
  }
  return history;
}

// Helper function to create batch request body
function createBatchRequestBody(urls: string[], boundary: string): string {
  let batchBody = "";

  urls.forEach((url, index) => {
    const requestBody = JSON.stringify({
      url,
      type: "URL_UPDATED",
    });

    batchBody += `--${boundary}\r\n`;
    batchBody += "Content-Type: application/http\r\n";
    batchBody += "Content-Transfer-Encoding: binary\r\n";
    batchBody += `Content-ID: <${Math.random().toString(RADIX_BASE_36).substring(BOUNDARY_SUBSTRING_START)}-${index + BATCH_ITEM_INDEX_OFFSET}>\r\n\r\n`;
    batchBody += "POST /v3/urlNotifications:publish HTTP/1.1\r\n";
    batchBody += "Content-Type: application/json\r\n";
    batchBody += "accept: application/json\r\n";
    batchBody += `content-length: ${requestBody.length}\r\n\r\n`;
    batchBody += requestBody;
    batchBody += "\r\n";
  });

  batchBody += `--${boundary}--\r\n`;

  return batchBody;
}

// Parse multipart batch response to check individual URL results
function parseBatchResponse(
  responseText: string,
  boundary: string
): {
  successfulUrls: number;
  hasErrors: boolean;
  errorDetails: string[];
} {
  const parts = responseText.split(`--${boundary}`);
  let successfulUrls = 0;
  let hasErrors = false;
  const errorDetails: string[] = [];

  for (const part of parts) {
    if (part.includes("HTTP/1.1")) {
      const statusMatch = part.match(HTTP_STATUS_REGEX);
      if (statusMatch) {
        const status = Number.parseInt(statusMatch[1], 10);
        if (status === HTTP_STATUS_CODE_OK) {
          successfulUrls++;
        } else {
          hasErrors = true;
          errorDetails.push(`HTTP ${status}`);

          // Check for specific error types
          if (status === HTTP_STATUS_CODE_TOO_MANY_REQUESTS) {
            errorDetails.push("Rate limit exceeded");
          } else if (status === HTTP_STATUS_CODE_FORBIDDEN) {
            errorDetails.push("Forbidden - check permissions");
          } else if (status === HTTP_STATUS_CODE_UNAUTHORIZED) {
            errorDetails.push("Unauthorized - check authentication");
          }
        }
      }
    }
  }

  return { successfulUrls, hasErrors, errorDetails };
}

// Helper function to submit a single batch to Google Indexing API
async function submitBatchToGoogle(
  batch: string[],
  accessToken: string,
  batchCount: number,
  totalBatches: number
): Promise<{ successfulUrls: string[]; shouldStop: boolean }> {
  logger.progress(
    batchCount,
    totalBatches,
    `Submitting batch ${batchCount} of ${totalBatches}`
  );

  // Generate a unique boundary for this batch
  const boundary = `===============${Math.random().toString(RADIX_BASE_36).substring(BOUNDARY_SUBSTRING_START)}==`;
  const batchBody = createBatchRequestBody(batch, boundary);

  try {
    const response = await fetch(GOOGLE_BATCH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/mixed; boundary="${boundary}"`,
        Authorization: `Bearer ${accessToken}`,
        Host: "indexing.googleapis.com",
      },
      body: batchBody,
    });

    const status = response.status;
    const responseText = await response.text();

    logger.info(`Batch ${batchCount} response status: ${status}`);

    // Log request details for debugging
    logger.info(`Batch ${batchCount} contained ${batch.length} URLs`);
    logger.info(`First URL in batch: ${batch[0]}`);

    // Handle non-200 status codes at the batch level
    if (status !== HTTP_STATUS_CODE_OK) {
      logger.error(`Batch ${batchCount} failed with status: ${status}`);
      logger.error(
        `Response headers: ${JSON.stringify(Object.fromEntries(response.headers))}`
      );
      logger.error(
        `Response body: ${responseText.substring(0, LOG_RESPONSE_MAX_LENGTH)}...`
      );

      // Stop on critical errors
      if (status === HTTP_STATUS_CODE_TOO_MANY_REQUESTS) {
        logger.error(
          "❌ RATE LIMIT EXCEEDED - Stopping script to avoid further penalties"
        );
        return { successfulUrls: [], shouldStop: true };
      }

      if (
        status === HTTP_STATUS_CODE_UNAUTHORIZED ||
        status === HTTP_STATUS_CODE_FORBIDDEN
      ) {
        logger.error("❌ AUTHENTICATION/PERMISSION ERROR - Stopping script");
        return { successfulUrls: [], shouldStop: true };
      }

      // Check for quota exceeded in response text
      if (
        responseText.toLowerCase().includes("quota") ||
        responseText.toLowerCase().includes("limit exceeded")
      ) {
        logger.error("❌ API QUOTA EXCEEDED - Stopping script");
        return { successfulUrls: [], shouldStop: true };
      }

      return { successfulUrls: [], shouldStop: false };
    }

    // Parse the multipart response to check individual URL results
    const parseResult = parseBatchResponse(responseText, boundary);

    logger.info(
      `Batch ${batchCount} results: ${parseResult.successfulUrls}/${batch.length} URLs successful`
    );

    // Log individual URL results for debugging
    if (parseResult.successfulUrls > 0) {
      logger.info(
        `✅ Successfully indexed ${parseResult.successfulUrls} URLs from batch ${batchCount}`
      );
      // Log first successful URL as sample
      if (batch.length > 0) {
        logger.info(`   Sample successful URL: ${batch[0]}`);
      }
    }
    if (parseResult.hasErrors) {
      const failedCount = batch.length - parseResult.successfulUrls;
      logger.warn(
        `❌ Failed to index ${failedCount} URLs from batch ${batchCount}`
      );
      // Log failed URLs if any
      if (parseResult.successfulUrls < batch.length) {
        const failedUrls = batch.slice(parseResult.successfulUrls);
        logger.warn(
          `   Failed URLs: ${failedUrls.slice(0, MAX_FAILED_URLS_TO_LOG).join(", ")}${failedUrls.length > MAX_FAILED_URLS_TO_LOG ? "..." : ""}`
        );
      }
    }

    if (parseResult.hasErrors) {
      logger.warn(
        `Batch ${batchCount} had errors: ${parseResult.errorDetails.join(", ")}`
      );

      // Stop if we hit rate limits in individual responses
      if (
        parseResult.errorDetails.some(
          (error) =>
            error.includes(HTTP_STATUS_CODE_TOO_MANY_REQUESTS.toString()) ||
            error.includes("Rate limit")
        )
      ) {
        logger.error(
          "❌ RATE LIMIT DETECTED IN BATCH RESPONSES - Stopping script"
        );
        return { successfulUrls: [], shouldStop: true };
      }
    }

    // Only return URLs that were actually successful
    const successfulUrls =
      parseResult.successfulUrls > 0
        ? batch.slice(0, parseResult.successfulUrls)
        : [];

    if (successfulUrls.length > 0) {
      logger.success(
        `Batch ${batchCount} completed (${successfulUrls.length} URLs successfully indexed)`
      );
    } else {
      logger.warn(`Batch ${batchCount} completed with no successful indexing`);
    }

    return { successfulUrls, shouldStop: false };
  } catch (error) {
    logger.error(`Network error in batch ${batchCount}: ${error}`);
    return { successfulUrls: [], shouldStop: false };
  }
}

// Submit URLs to Google Indexing API
async function submitUrlsToGoogle(
  urls: string[],
  accessToken: string
): Promise<string[]> {
  if (urls.length === 0) {
    logger.info("No new URLs to submit to Google Indexing API.");
    return [];
  }

  // Split URLs into batches
  const batchSize = BATCH_SIZE;
  const batches: string[][] = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }

  logger.info(`Submitting ${urls.length} URLs to Google Indexing API...`);
  logger.info(`Processing ${batches.length} batches of ${batchSize} URLs each`);

  const successfullySubmitted: string[] = [];
  const totalBatches = batches.length;
  let shouldStop = false;
  let currentDelay = RATE_LIMIT_DELAY;

  // Process batches sequentially to respect rate limits
  for (let index = 0; index < batches.length; index++) {
    if (shouldStop) {
      logger.warn(`Stopping at batch ${index + 1} due to API errors`);
      break;
    }

    const batch = batches[index];

    try {
      const batchResult = await submitBatchToGoogle(
        batch,
        accessToken,
        index + 1,
        totalBatches
      );

      // Check if we should stop
      if (batchResult.shouldStop) {
        shouldStop = true;
        logger.error("Stopping submission process due to API errors");
        break;
      }

      // Add only successfully submitted URLs
      if (batchResult.successfulUrls.length > 0) {
        successfullySubmitted.push(...batchResult.successfulUrls);
        logger.info(
          `Total successfully submitted so far: ${successfullySubmitted.length}`
        );

        // Reset delay on successful batch
        currentDelay = RATE_LIMIT_DELAY;
      } else if (batchResult.successfulUrls.length === 0) {
        // Increase delay if no URLs were successful (likely hitting rate limits)
        currentDelay = Math.min(
          currentDelay * BACKOFF_MULTIPLIER,
          MAX_BACKOFF_DELAY
        );
        logger.warn(
          `No URLs successful in batch ${index + 1}, increasing delay to ${currentDelay}ms`
        );
      }

      // Rate limiting delay between batches (but not after the last batch or if stopping)
      if (index < totalBatches - 1 && !shouldStop) {
        logger.info(`Waiting ${currentDelay}ms before next batch...`);
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
      }
    } catch (error) {
      logger.error(`Error submitting batch ${index + 1}: ${error}`);

      // Stop on critical network errors
      if (
        error?.toString().includes("fetch failed") ||
        error?.toString().includes("network")
      ) {
        logger.error("Network error detected - stopping script");
        shouldStop = true;
        break;
      }
    }
  }

  const finalMessage = shouldStop
    ? `Google Indexing API submission stopped due to errors. Successfully submitted ${successfullySubmitted.length}/${urls.length} URLs.`
    : `Google Indexing API submission completed. Successfully submitted ${successfullySubmitted.length}/${urls.length} URLs.`;

  logger.info(finalMessage);

  return successfullySubmitted;
}

// Main function to run the Google indexing process
async function runGoogleIndexing(): Promise<void> {
  logger.header("Starting Google Indexing API Submission Process");

  try {
    // Initialize Google authentication
    const auth = initializeGoogleAuth();
    const accessToken = await getGoogleAccessToken(auth);

    logger.stats("Google service account", "Authenticated successfully");
    logger.stats("Website URL", host);
    logger.stats("Batch size", BATCH_SIZE);
    logger.stats("Rate limit delay", `${RATE_LIMIT_DELAY}ms`);

    // Get unsubmitted URLs
    const { urls, history } = await getUnsubmittedUrls();

    if (urls.length === 0) {
      logger.info(
        "No new URLs to submit to Google Indexing API. All URLs have been previously submitted."
      );
      return;
    }

    // Submit URLs to Google Indexing API
    const successfullySubmitted = await submitUrlsToGoogle(urls, accessToken);

    // Always save progress, even if we had to stop early
    if (successfullySubmitted.length > 0) {
      // Update and save submission history
      const updatedHistory = updateGoogleIndexHistory(
        history,
        successfullySubmitted
      );
      saveGoogleIndexHistory(updatedHistory);

      logger.success(
        `Google Index history updated with ${successfullySubmitted.length} successfully submitted URLs.`
      );
    } else {
      logger.warn("No URLs were successfully submitted to Google Indexing API");
    }

    // Final summary
    logger.info(`Total URLs processed: ${urls.length}`);
    logger.info(`Successfully submitted: ${successfullySubmitted.length}`);

    if (urls.length > 0) {
      const successRate = Math.round(
        (successfullySubmitted.length / urls.length) * PERCENTAGE_MULTIPLIER
      );
      logger.info(`Success rate: ${successRate}%`);

      // Warn if success rate is low
      if (successRate < SUCCESS_RATE_THRESHOLD) {
        logger.warn(
          "⚠️  Low success rate detected. Check for API quota limits or authentication issues."
        );
      }
    }

    if (successfullySubmitted.length > 0) {
      logger.info("✅ URLs have been submitted to Google Indexing API");
      logger.info(
        "📊 Check API usage: Google Cloud Console → APIs & Services → Dashboard → Indexing API"
      );
      logger.info(
        "🔍 Monitor indexing: Google Search Console → Coverage or URL Inspection"
      );
      logger.info(
        "⏰ Note: It may take time for Google to process and index the URLs"
      );
    }

    // Exit with error code if no URLs were successfully submitted
    if (successfullySubmitted.length === 0 && urls.length > 0) {
      logger.error(
        "❌ No URLs were successfully submitted. Check the errors above."
      );
      logger.header("Google Indexing API Submission Process Failed");
      process.exit(1);
    }

    logger.header("Google Indexing API Submission Process Completed");
  } catch (error) {
    logger.error(`Error in Google indexing process: ${error}`);

    // Provide helpful error messages
    if (
      error?.toString().includes("credentials") ||
      error?.toString().includes("authentication")
    ) {
      logger.error(
        "Authentication failed. Please check your google-key.json file."
      );
    } else if (
      error?.toString().includes("quota") ||
      error?.toString().includes("limit")
    ) {
      logger.error(
        "API quota exceeded. Please try again later or contact Google Support to increase your quota."
      );
    }

    throw error;
  }
}

// Run the script
runGoogleIndexing().catch((error) => {
  logger.error(`Error running Google indexing script: ${error}`);
  process.exit(1);
});
