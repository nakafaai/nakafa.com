import FirecrawlApp from "@mendable/firecrawl-js";
import { firecrawlKeys } from "@repo/ai/keys";

let firecrawlApp: FirecrawlApp | undefined;

/**
 * Returns the Firecrawl client after validating the runtime API key once.
 *
 * Search and scrape routes import this module during Next build, but the
 * Firecrawl secret is only needed when those tools execute.
 */
export function readFirecrawlApp() {
  if (firecrawlApp) {
    return firecrawlApp;
  }

  firecrawlApp = new FirecrawlApp({
    apiKey: firecrawlKeys().FIRECRAWL_API_KEY,
  });

  return firecrawlApp;
}
