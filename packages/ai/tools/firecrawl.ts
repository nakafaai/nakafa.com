import FirecrawlApp from "@mendable/firecrawl-js";
import { tool } from "ai";
import { keys } from "../keys";
import {
  scrapeInputSchema,
  scrapeOutputSchema,
  webSearchInputSchema,
  webSearchOutputSchema,
} from "../schema/tools";

const app = new FirecrawlApp({ apiKey: keys().FIRECRAWL_API_KEY });

const MAX_CONTENT_LENGTH = 800; // Keep search results under 800 chars to manage token costs
const MAX_SCRAPE_CONTENT_LENGTH = 2000; // Allow more content for specific URL scraping

// Truncation thresholds for smart content cutting
const SENTENCE_THRESHOLD = 0.7; // Use sentence boundary if 70% or more of max length
const NEWLINE_THRESHOLD = 0.7; // Use newline boundary if 70% or more of max length
const WORD_THRESHOLD = 0.8; // Use word boundary if 80% or more of max length

// Helper function to truncate content while preserving readability
function truncateContent(
  content: string,
  maxLength: number = MAX_CONTENT_LENGTH
): string {
  if (content.length <= maxLength) {
    return content;
  }

  // Try to cut at the end of a sentence
  const truncated = content.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf(". ");
  const lastNewline = truncated.lastIndexOf("\n");

  // Use sentence boundary if it exists and is not too short
  if (lastSentence > maxLength * SENTENCE_THRESHOLD) {
    return truncated.substring(0, lastSentence + 1);
  }

  // Use newline boundary if it exists and is not too short
  if (lastNewline > maxLength * NEWLINE_THRESHOLD) {
    return truncated.substring(0, lastNewline);
  }

  // Otherwise, cut at word boundary
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * WORD_THRESHOLD) {
    return `${truncated.substring(0, lastSpace)}...`;
  }

  return `${truncated}...`;
}

export const scrapeTool = tool({
  name: "scrape",
  description: "Scrape a URL and return the content",
  inputSchema: scrapeInputSchema,
  outputSchema: scrapeOutputSchema,
  async execute({ urlToCrawl }) {
    try {
      const response = await app.scrape(urlToCrawl, {
        formats: ["markdown"],
      });

      const markdown = response.markdown;

      if (!markdown) {
        return { data: { url: "", content: "" }, error: "No content found." };
      }

      return {
        data: {
          url: urlToCrawl,
          content: truncateContent(markdown, MAX_SCRAPE_CONTENT_LENGTH),
        },
        error: undefined,
      };
    } catch (error) {
      return {
        data: { url: "", content: "" },
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
        limit: 3,
        sources: ["web", "news"],
        scrapeOptions: { formats: ["markdown"] },
      });

      const news =
        response.news?.map((result) => ({
          title: ("title" in result ? result.title : "") || "",
          url: ("url" in result ? result.url : "") || "",
          content: truncateContent(
            ("markdown" in result ? result.markdown : "") || ""
          ),
        })) || [];

      const web =
        response.web?.map((result) => ({
          title: ("title" in result ? result.title : "") || "",
          url: ("url" in result ? result.url : "") || "",
          content: truncateContent(
            ("markdown" in result ? result.markdown : "") || ""
          ),
        })) || [];

      return { data: { news, web }, error: undefined };
    } catch (error) {
      return {
        data: { news: [], web: [] },
        error: `Failed to search: ${error}`,
      };
    }
  },
});
