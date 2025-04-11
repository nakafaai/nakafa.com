// Load environment variables from .env file
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { getAllRoutes, getEntries } from "../app/sitemap";

// References:
// - https://www.bing.com/indexnow/getstarted
// - https://www.bing.com/webmasters/url-submission-api#APIs

// Logger utility for colored output
const logger = {
  // Colors and styles
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  // Foreground colors
  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    crimson: "\x1b[38m",
  },

  // Background colors
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
    crimson: "\x1b[48m",
  },

  // Log methods
  info: (message: string): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.blue}${logger.bright}ℹ INFO:${logger.reset} ${message}`
    );
  },

  success: (message: string): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.green}${logger.bright}✓ SUCCESS:${logger.reset} ${message}`
    );
  },

  warn: (message: string): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.warn(
      `${logger.fg.yellow}${logger.bright}⚠ WARNING:${logger.reset} ${message}`
    );
  },

  error: (message: string): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.error(
      `${logger.fg.red}${logger.bright}✗ ERROR:${logger.reset} ${message}`
    );
  },

  header: (message: string): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `\n${logger.fg.cyan}${logger.bright}═══════════════════════════════════════════════════════════════════${logger.reset}`
    );
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.cyan}${logger.bright}  ${message}${logger.reset}`
    );
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.cyan}${logger.bright}═══════════════════════════════════════════════════════════════════${logger.reset}\n`
    );
  },

  stats: (label: string, value: string | number): void => {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.magenta}${logger.bright}▸ ${label}:${logger.reset} ${value}`
    );
  },

  progress: (current: number, total: number, label: string): void => {
    const percentage = Math.round((current / total) * 100);
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      `${logger.fg.cyan}${logger.bright}▸ ${label}:${logger.reset} ${current}/${total} (${percentage}%)`
    );
  },
};

// Configuration
const host = "https://nakafa.com";
const keyFileName = "e22d548f7fd2482a9022e3b84e944901.txt";
const keyLocation = `${host}/${keyFileName}`;
const hardcodedKey = "e22d548f7fd2482a9022e3b84e944901";

// Data folder and file paths
const DATA_FOLDER = path.join(__dirname, "_data");
const SUBMISSION_HISTORY_FILE = path.join(
  DATA_FOLDER,
  "submission-history.json"
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
      if (!parsed.indexNow && !parsed.bing) {
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
      `Error loading submission history: ${error}. Starting with empty history.`
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
      "utf8"
    );
  } catch (error) {
    logger.error(`Error saving submission history: ${error}`);
  }
}

// Get all URLs from the sitemap that haven't been submitted yet
function getUnsubmittedUrls(service: "indexNow" | "bing"): {
  urls: string[];
  history: { indexNow: Record<string, string>; bing: Record<string, string> };
} {
  // Load existing submission history
  const history = loadSubmissionHistory();

  // Get all URLs from sitemap
  const routes = getAllRoutes();
  const allEntries = routes.flatMap((route) => getEntries(route));

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

  return { urls, history };
}

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

// Submit URLs to IndexNow
async function submitUrlsToIndexNow(
  urls: string[],
  key: string
): Promise<string[]> {
  if (urls.length === 0) {
    logger.info("No new URLs to submit to IndexNow.");
    return [];
  }

  const apiEndpoint = "https://api.indexnow.org";

  // Split URLs into batches of 100
  const batchSize = 100;

  logger.info(`Submitting ${urls.length} URLs to IndexNow...`);

  const successfullySubmitted: string[] = [];
  let batchCount = 0;
  const totalBatches = Math.ceil(urls.length / batchSize);

  for (let i = 0; i < urls.length; i += batchSize) {
    batchCount++;
    const batch = urls.slice(i, i + batchSize);

    try {
      logger.progress(
        batchCount,
        totalBatches,
        `Submitting batch ${batchCount} of ${totalBatches}`
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

      if (status !== 200) {
        logger.error(`Batch ${batchCount} failed with status: ${status}`);
      } else {
        logger.success(`Batch ${batchCount} completed (${batch.length} URLs)`);
        // Track successfully submitted URLs
        successfullySubmitted.push(...batch);
      }

      // Avoid rate limiting
      if (i + batchSize < urls.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error(`Error submitting batch ${batchCount}: ${error}`);
    }
  }

  logger.info(
    `IndexNow submission completed. Successfully submitted ${successfullySubmitted.length}/${urls.length} URLs.`
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
  batch: string[]
): Promise<{
  success: boolean;
  quotaRemaining: number | null;
  shouldBreak: boolean;
}> {
  const status = response.status;
  const responseText = await response.text();

  logger.info(`Bing API response status: ${status}`);

  if (status !== 200) {
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

// Submit URLs to Bing URL Submission API
async function submitUrlsToBing(
  urls: string[],
  apiKey: string
): Promise<string[]> {
  if (urls.length === 0) {
    logger.info("No new URLs to submit to Bing.");
    return [];
  }

  const apiEndpoint =
    "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch";

  // Set a safer default batch size to respect Bing's quota
  let batchSize = 100; // Reduced from 500 to 100 to stay within quota

  logger.info("Starting Bing URL Submission API process...");
  logger.stats("URLs to submit", urls.length);
  logger.stats("Initial batch size", batchSize);

  let submitted = 0;
  let retryCount = 0;
  const MAX_RETRIES = 2;
  const successfullySubmitted: string[] = [];

  while (submitted < urls.length) {
    // Calculate how many URLs to submit in this batch
    const currentBatchSize = Math.min(batchSize, urls.length - submitted);
    const batch = urls.slice(submitted, submitted + currentBatchSize);
    const startIdx = submitted + 1;
    const endIdx = submitted + batch.length;

    try {
      logger.info(
        `Submitting batch of ${batch.length} URLs to Bing (${startIdx} to ${endIdx})`
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

      if (result.shouldBreak) {
        break;
      }

      if (result.success) {
        // Track successfully submitted URLs
        successfullySubmitted.push(...batch);

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
        retryCount++;
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
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logger.error(`Error submitting URLs to Bing: ${error}`);
      // Increment retry count and exit if max retries reached
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        logger.warn(
          `Maximum retries (${MAX_RETRIES}) reached. Stopping submission.`
        );
        break;
      }
    }
  }

  logger.info(
    `Bing URL Submission API process completed. Submitted ${submitted}/${urls.length} URLs.`
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
  const indexNowData = getUnsubmittedUrls("indexNow");

  if (indexNowData.urls.length === 0) {
    logger.info(
      "No new URLs to submit to IndexNow. All URLs have been previously submitted."
    );
  } else {
    // Submit URLs to IndexNow
    const indexNowSuccessful = await submitUrlsToIndexNow(
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
      saveSubmissionHistory(updatedHistory);
      logger.success(
        `Submission history updated for IndexNow with ${indexNowSuccessful.length} successfully submitted URLs.`
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
    const bingData = getUnsubmittedUrls("bing");

    if (bingData.urls.length === 0) {
      logger.info(
        "No new URLs to submit to Bing. All URLs have been previously submitted."
      );
    } else {
      // Submit URLs to Bing URL Submission API
      const bingSuccessful = await submitUrlsToBing(bingData.urls, bingApiKey);

      if (bingSuccessful.length > 0) {
        // Update submission history for Bing successful submissions
        const updatedHistory = updateSubmissionHistory(
          bingData.history,
          bingSuccessful,
          "bing"
        );
        saveSubmissionHistory(updatedHistory);
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
}

// Run the script
runIndexNow().catch((error) => {
  logger.error(`Error running script: ${error}`);
  process.exit(1);
});
