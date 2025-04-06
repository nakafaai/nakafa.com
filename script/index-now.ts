import { getAllRoutes, getEntries } from "../app/sitemap";

// References: https://www.bing.com/indexnow/getstarted

// Configuration
const host = "https://nakafa.com";
const keyFileName = "cf801ba46a4343b39c2df98eaa695927.txt";
const keyLocation = `${host}/${keyFileName}`;
const hardcodedKey = "cf801ba46a4343b39c2df98eaa695927";

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

  return Array.from(urls);
}

// Submit URLs to IndexNow
async function submitUrlsToIndexNow(
  urls: string[],
  key: string
): Promise<void> {
  const apiEndpoint = "https://api.indexnow.org";

  // Split URLs into batches of 10,000 (max allowed per request)
  const batchSize = 10000;

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

  // Get all URLs
  const urls = getAllUrls();
  // biome-ignore lint/suspicious/noConsole: For logging
  console.info(`Found ${urls.length} URLs to submit.`);

  // Submit URLs
  await submitUrlsToIndexNow(urls, apiKey);

  // biome-ignore lint/suspicious/noConsole: For logging
  console.info("IndexNow submission completed.");
}

// Run the script
runIndexNow().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: For logging
  console.error("Error running IndexNow script:", error);
  process.exit(1);
});
