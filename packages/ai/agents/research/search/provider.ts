import { ResearchSearchError } from "@repo/ai/agents/research/schema";
import { firecrawlApp } from "@repo/ai/config/firecrawl";
import { Effect } from "effect";

/** Calls Firecrawl search with one generated query. */
export function searchFirecrawl(query: string) {
  return Effect.tryPromise({
    try: () =>
      firecrawlApp.search(query, {
        limit: 5,
        sources: ["web", "news"],
        scrapeOptions: {
          formats: ["markdown"],
          onlyMainContent: true,
          parsers: [],
        },
        timeout: 10_000,
      }),
    catch: (error) =>
      new ResearchSearchError({ message: `Failed to search: ${error}` }),
  }).pipe(Effect.map((response) => ({ query, response })));
}
