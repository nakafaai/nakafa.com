import FirecrawlApp from "@mendable/firecrawl-js";
import { tool } from "ai";
import { keys } from "../keys";
import { selectRelevantContent } from "../lib/content-selection";
import {
  scrapeInputSchema,
  scrapeOutputSchema,
  webSearchInputSchema,
  webSearchOutputSchema,
} from "../schema/tools";

const app = new FirecrawlApp({ apiKey: keys().FIRECRAWL_API_KEY });

export const scrapeTool = tool({
  name: "scrape",
  description:
    "Scrape a URL and return the content. Use this for specific URLs to get the content of the url.",
  inputSchema: scrapeInputSchema,
  outputSchema: scrapeOutputSchema,
  async execute({ urlToCrawl }) {
    const url = urlToCrawl;
    try {
      const response = await app.scrape(url, {
        formats: ["markdown"],
      });

      const markdown = response.markdown;

      if (!markdown) {
        return { data: { url, content: "" }, error: "No content found." };
      }

      // Use smart content selection to truncate long content while preserving readability
      const processedContent = selectRelevantContent({
        content: markdown,
        maxLength: 3000, // Longer limit for scraped content
      });

      return {
        data: {
          url,
          content: processedContent,
        },
        error: undefined,
      };
    } catch (error) {
      return {
        data: { url, content: "" },
        error: `Failed to crawl: ${error}`,
      };
    }
  },
});

export const webSearchTool = tool({
  name: "webSearch",
  description: "Search the web for up-to-date information",
  inputSchema: webSearchInputSchema,
  outputSchema: webSearchOutputSchema,
  async execute({ query }) {
    try {
      const response = await app.search(query, {
        limit: 4,
        sources: ["web", "news"],
        scrapeOptions: { formats: ["markdown"] },
      });

      const news =
        response.news?.map((result) => {
          const rawContent =
            ("markdown" in result ? result.markdown : "") || "";
          const processedContent = selectRelevantContent({
            content: rawContent,
            query, // Use the search query for relevance scoring
            preserveStructure: false, // Focus on relevance over structure
          });

          return {
            title: ("title" in result ? result.title : "") || "",
            description: ("snippet" in result ? result.snippet : "") || "",
            url: ("url" in result ? result.url : "") || "",
            content: processedContent,
          };
        }) || [];

      const web =
        response.web?.map((result) => {
          const rawContent =
            ("markdown" in result ? result.markdown : "") || "";
          const processedContent = selectRelevantContent({
            content: rawContent,
            query, // Use the search query for relevance scoring
            preserveStructure: false, // Focus on relevance over structure
          });

          return {
            title: ("title" in result ? result.title : "") || "",
            description:
              ("description" in result ? result.description : "") || "",
            url: ("url" in result ? result.url : "") || "",
            content: processedContent,
          };
        }) || [];

      return { data: { news, web }, error: undefined };
    } catch (error) {
      return {
        data: { news: [], web: [] },
        error: `Failed to search: ${error}`,
      };
    }
  },
});
