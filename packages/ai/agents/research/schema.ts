import * as z from "zod";

const MAX_URL_LENGTH = 100;

/**
 * Input schema for scrape tool
 */
export const scrapeInputSchema = z
  .object({
    urlToCrawl: z
      .url()
      .min(1)
      .max(MAX_URL_LENGTH)
      .describe("The URL to scrape (including http:// or https://)"),
  })
  .describe("Get the content of a URL");
export type ScrapeInput = z.input<typeof scrapeInputSchema>;

/**
 * Output schema for scrape tool
 */
export const scrapeOutputSchema = z.object({
  data: z.object({
    url: z.string(),
    content: z.string(),
  }),
  error: z.string().optional(),
});
export type ScrapeOutput = z.output<typeof scrapeOutputSchema>;

/**
 * Input schema for web search tool
 */
export const webSearchInputSchema = z
  .object({
    query: z.string().describe("The query to search web for"),
  })
  .describe("Search the web for up-to-date information using a text query");
export type WebSearchInput = z.input<typeof webSearchInputSchema>;

/**
 * Output schema for web search tool
 */
export const webSearchOutputSchema = z
  .object({
    sources: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        url: z.string(),
        content: z.string(),
        citation: z.string(),
      })
    ),
    error: z.string().optional(),
  })
  .describe(
    "The output schema for web search results. Use exactly to citation field for inline citations."
  );
export type WebSearchOutput = z.output<typeof webSearchOutputSchema>;
