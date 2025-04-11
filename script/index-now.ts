import { getAllRoutes, getEntries } from "../app/sitemap";

// References:
// - https://www.bing.com/indexnow/getstarted
// - https://www.bing.com/webmasters/url-submission-api#APIs

// Configuration
const host = "https://nakafa.com";
const keyFileName = "e22d548f7fd2482a9022e3b84e944901.txt";
const keyLocation = `${host}/${keyFileName}`;
const hardcodedKey = "e22d548f7fd2482a9022e3b84e944901";

// Bing Webmaster API configuration - You need to replace this with your actual API key
const bingApiKey =
  process.env.BING_WEBMASTER_API_KEY || "YOUR_BING_WEBMASTER_API_KEY";

// Get API key - using hardcoded key instead of generating a new one
function getApiKey(): string {
  return hardcodedKey;
}

// Get all URLs from the sitemap
function getAllUrls(): string[] {
  const routes = getAllRoutes();
  const allEntries = routes.flatMap((route) => getEntries(route));

  // Extract unique URLs
  const urls = new Set<string>();
  for (const entry of allEntries) {
    urls.add(entry.url);
  }

  // Uncomment to log all URLs
  // biome-ignore lint/suspicious/noConsole: For logging
  console.info("URLs:", Array.from(urls));

  return Array.from(urls);
}

// Submit URLs to IndexNow
async function submitUrlsToIndexNow(
  urls: string[],
  key: string
): Promise<void> {
  const apiEndpoint = "https://api.indexnow.org";

  // Split URLs into batches of 500 (max allowed per request)
  const batchSize = 500;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    try {
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

      // biome-ignore lint/suspicious/noConsole: For logging
      console.info(`Batch ${Math.floor(i / batchSize) + 1} response:`, status);

      if (status !== 200) {
        // biome-ignore lint/suspicious/noConsole: For logging
        console.error(`Error submitting URLs to IndexNow. Status: ${status}`);
      } else {
        // biome-ignore lint/suspicious/noConsole: For logging
        console.info(
          `Successfully submitted ${batch.length} URLs to IndexNow.`
        );
      }

      // Avoid rate limiting
      if (i + batchSize < urls.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: For logging
      console.error("Error submitting URLs:", error);
    }
  }
}

// Submit URLs to Bing URL Submission API
async function submitUrlsToBing(urls: string[], apiKey: string): Promise<void> {
  const apiEndpoint =
    "https://ssl.bing.com/webmaster/api.svc/json/SubmitUrlbatch";

  // Split URLs into batches (up to 500 per day, but we'll use smaller batches)
  const batchSize = 500;

  // biome-ignore lint/suspicious/noConsole: For logging
  console.info("Starting Bing URL Submission API process...");

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);

    try {
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

      const status = response.status;

      // biome-ignore lint/suspicious/noConsole: For logging
      console.info(
        `Bing API Batch ${Math.floor(i / batchSize) + 1} response:`,
        status
      );

      if (status !== 200) {
        // biome-ignore lint/suspicious/noConsole: For logging
        console.error(`Error submitting URLs to Bing. Status: ${status}`);
        const responseText = await response.text();
        // biome-ignore lint/suspicious/noConsole: For logging
        console.error(`Response: ${responseText}`);
      } else {
        // biome-ignore lint/suspicious/noConsole: For logging
        console.info(
          `Successfully submitted ${batch.length} URLs to Bing URL Submission API.`
        );
      }

      // Avoid rate limiting
      if (i + batchSize < urls.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      // biome-ignore lint/suspicious/noConsole: For logging
      console.error("Error submitting URLs to Bing:", error);
    }
  }

  // biome-ignore lint/suspicious/noConsole: For logging
  console.info("Bing URL Submission API process completed.");
}

// Main function to run the indexing process
async function runIndexNow(): Promise<void> {
  // biome-ignore lint/suspicious/noConsole: For logging
  console.info("Starting IndexNow submission...");

  // Get API key
  const apiKey = getApiKey();
  // biome-ignore lint/suspicious/noConsole: For logging
  console.info(`Using IndexNow key: ${apiKey}`);
  // biome-ignore lint/suspicious/noConsole: For logging
  console.info(`Key file location: ${keyLocation}`);

  // biome-ignore lint/suspicious/noConsole: For logging
  console.info("Website URL:", host);
  // biome-ignore lint/suspicious/noConsole: For logging
  console.info("Host URL:", new URL(host).hostname);

  // Get all URLs
  const urls = getAllUrls();
  // biome-ignore lint/suspicious/noConsole: For logging
  console.info(`Found ${urls.length} URLs to submit.`);

  // Submit URLs to IndexNow
  await submitUrlsToIndexNow(urls, apiKey);
  // biome-ignore lint/suspicious/noConsole: For logging
  console.info("IndexNow submission completed.");

  // Check if Bing API key is configured
  if (bingApiKey && bingApiKey !== "YOUR_BING_WEBMASTER_API_KEY") {
    // Submit URLs to Bing URL Submission API
    await submitUrlsToBing(urls, bingApiKey);
  } else {
    // biome-ignore lint/suspicious/noConsole: For logging
    console.warn(
      "Bing Webmaster API key not configured. Skipping Bing URL Submission."
    );
    // biome-ignore lint/suspicious/noConsole: For logging
    console.info(
      "To enable Bing URL Submission, replace 'YOUR_BING_WEBMASTER_API_KEY' with your actual Bing Webmaster API key."
    );
  }
}

// Run the script
runIndexNow().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: For logging
  console.error("Error running script:", error);
  process.exit(1);
});
