import FirecrawlApp from "@mendable/firecrawl-js";
import { keys } from "@repo/ai/keys";

/**
 * Firecrawl client instance configured with API key
 * Provides web scraping and search capabilities
 */
export const firecrawlApp = new FirecrawlApp({
  apiKey: keys().FIRECRAWL_API_KEY,
});
