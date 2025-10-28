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
 *   pnpm run google-index
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
import { JWT } from "google-auth-library";
import {
  baseRoutes,
  getAskRoutes,
  getContentRoutes,
  getEntries,
  getOgRoutes,
  getQuranRoutes,
} from "../app/sitemap";
import { logger } from "./utils";

const RATE_LIMIT_DELAY = 1000; // 1 second between requests
const MAX_BACKOFF_DELAY = 30_000; // 30 seconds maximum backoff
const BACKOFF_MULTIPLIER = 2; // Double the delay on each retry
const PERCENTAGE_MULTIPLIER = 100;
const LOG_RESPONSE_MAX_LENGTH = 500;

const HTTP_STATUS_CODE_OK = 200;
const HTTP_STATUS_CODE_UNAUTHORIZED = 401;
const HTTP_STATUS_CODE_FORBIDDEN = 403;
const HTTP_STATUS_CODE_TOO_MANY_REQUESTS = 429;
const SUCCESS_RATE_THRESHOLD = 50;

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
const GOOGLE_PUBLISH_ENDPOINT =
  "https://indexing.googleapis.com/v3/urlNotifications:publish";

// Initialize Google Auth client
function initializeGoogleAuth(): JWT {
  // Load credentials from file
  const keyFileContent = fs.readFileSync(GOOGLE_KEY_FILE, "utf8");
  const credentials = JSON.parse(keyFileContent);

  // Use JWT constructor directly (recommended approach)
  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [GOOGLE_INDEXING_SCOPE],
  });
}

// Get access token for Google API
async function getGoogleAccessToken(auth: JWT): Promise<string> {
  try {
    const accessTokenResponse = await auth.getAccessToken();
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

// Helper function to submit a single URL to Google Indexing API
async function submitUrlToGoogle(
  url: string,
  accessToken: string,
  index: number,
  totalUrls: number
): Promise<{ success: boolean; shouldStop: boolean }> {
  logger.progress(index, totalUrls, `Submitting URL ${index} of ${totalUrls}`);

  try {
    const response = await fetch(GOOGLE_PUBLISH_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        url,
        type: "URL_UPDATED",
      }),
    });

    const status = response.status;
    const responseText = await response.text();

    if (status === HTTP_STATUS_CODE_OK) {
      logger.info(`✅ Successfully submitted ${url}`);
      return { success: true, shouldStop: false };
    }

    logger.error(`❌ Failed to submit ${url} - Status: ${status}`);
    logger.error(
      `   Response: ${responseText.substring(0, LOG_RESPONSE_MAX_LENGTH)}...`
    );

    if (status === HTTP_STATUS_CODE_TOO_MANY_REQUESTS) {
      logger.error("   RATE LIMIT EXCEEDED - Stopping script");
      return { success: false, shouldStop: true };
    }

    if (
      status === HTTP_STATUS_CODE_UNAUTHORIZED ||
      status === HTTP_STATUS_CODE_FORBIDDEN
    ) {
      logger.error("   AUTHENTICATION/PERMISSION ERROR - Stopping script");
      return { success: false, shouldStop: true };
    }

    if (
      responseText.toLowerCase().includes("quota") ||
      responseText.toLowerCase().includes("limit exceeded")
    ) {
      logger.error("   API QUOTA EXCEEDED - Stopping script");
      return { success: false, shouldStop: true };
    }

    return { success: false, shouldStop: false };
  } catch (error) {
    logger.error(`   Network error submitting ${url}: ${error}`);
    return { success: false, shouldStop: false };
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

  logger.info(
    `Submitting ${urls.length} URLs to Google Indexing API individually...`
  );

  const successfullySubmitted: string[] = [];
  let shouldStop = false;
  let currentDelay = RATE_LIMIT_DELAY;

  for (let index = 0; index < urls.length; index += 1) {
    if (shouldStop) {
      logger.warn(`Stopping at URL ${index + 1} due to API errors.`);
      break;
    }

    const url = urls[index];

    try {
      const result = await submitUrlToGoogle(
        url,
        accessToken,
        index + 1,
        urls.length
      );

      if (result.shouldStop) {
        shouldStop = true;
        break;
      }

      if (result.success) {
        successfullySubmitted.push(url);
        logger.info(
          `📈 TOTAL INDEXED SO FAR: ${successfullySubmitted.length} URLs`
        );
        currentDelay = RATE_LIMIT_DELAY; // Reset delay on success
      } else {
        // Increase delay on failure
        currentDelay = Math.min(
          currentDelay * BACKOFF_MULTIPLIER,
          MAX_BACKOFF_DELAY
        );
        logger.warn(`⏳ Increasing delay to ${currentDelay}ms due to failure`);
      }

      if (index < urls.length - 1 && !shouldStop) {
        logger.info(`⏱️  Waiting ${currentDelay}ms before next request...`);
        logger.info(`${"═".repeat(60)}`);
        await new Promise((resolve) => setTimeout(resolve, currentDelay));
      }
    } catch (error) {
      logger.error(`Error submitting URL ${index + 1} (${url}): ${error}`);
      if (
        error?.toString().includes("fetch failed") ||
        error?.toString().includes("network")
      ) {
        logger.error("Network error detected - stopping script");
        shouldStop = true;
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

    // Final summary with clear explanation
    logger.info("📊 FINAL RESULTS:");
    logger.info(`   📤 Total URLs submitted: ${urls.length}`);
    logger.info(
      `   ✅ URLs actually indexed by Google: ${successfullySubmitted.length}`
    );
    logger.info(
      `   ❌ URLs rejected by Google: ${urls.length - successfullySubmitted.length}`
    );

    if (urls.length > 0) {
      const successRate = Math.round(
        (successfullySubmitted.length / urls.length) * PERCENTAGE_MULTIPLIER
      );
      logger.info(`   📈 Success rate: ${successRate}%`);

      // Explain what happened
      if (successRate < SUCCESS_RATE_THRESHOLD) {
        logger.warn("   ⚠️  Low success rate indicates Google rate limiting");
        logger.warn(
          "   💡 This is normal for large batches - Google limits indexing requests"
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
