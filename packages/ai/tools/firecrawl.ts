import FirecrawlApp from "@mendable/firecrawl-js";
import { tool, type UIMessageStreamWriter } from "ai";
import { keys } from "../keys";
import { selectRelevantContent } from "../lib/content-selection";
import { extractDomain } from "../lib/utils";
import { scrapeInputSchema, webSearchInputSchema } from "../schema/tools";
import type { MyUIMessage } from "../types/message";

const app = new FirecrawlApp({ apiKey: keys().FIRECRAWL_API_KEY });

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createScrape = ({ writer }: Params) => {
  return tool({
    name: "scrape",
    description:
      "Scrape a URL and return the content. Use this for specific URLs to get the content of the url.",
    inputSchema: scrapeInputSchema,
    execute: async ({ urlToCrawl }, { toolCallId }) => {
      const url = urlToCrawl;

      writer.write({
        id: toolCallId,
        type: "data-scrape-url",
        data: { url, status: "loading", content: "" },
      });

      try {
        const response = await app.scrape(url, {
          formats: ["markdown"],
          timeout: 5000, // 5 second timeout
        });

        const markdown = response.markdown;

        if (!markdown) {
          writer.write({
            id: toolCallId,
            type: "data-scrape-url",
            data: {
              url,
              status: "error",
              content: "",
              error: {
                message: "No content found.",
              },
            },
          });

          return { data: { url, content: "" }, error: "No content found." };
        }

        // Use smart content selection to truncate long content while preserving readability
        const processedContent = selectRelevantContent({
          content: markdown,
          maxLength: 3000, // Longer limit for scraped content
        });

        writer.write({
          id: toolCallId,
          type: "data-scrape-url",
          data: { url, status: "done", content: processedContent },
        });

        return {
          data: {
            url,
            content: processedContent,
          },
          error: undefined,
        };
      } catch (error) {
        const errorMessage = `Failed to crawl: ${error}`;
        writer.write({
          id: toolCallId,
          type: "data-scrape-url",
          data: {
            url,
            status: "error",
            content: "",
            error: { message: errorMessage },
          },
        });

        return {
          data: { url, content: "" },
          error: errorMessage,
        };
      }
    },
  });
};

export const createWebSearch = ({ writer }: Params) => {
  return tool({
    name: "webSearch",
    description:
      "Search the web for up-to-date information and as universal fallback for ANY topic when Nakafa content is insufficient. Use exactly the citation field for inline citations.",
    inputSchema: webSearchInputSchema,
    execute: async ({ query }, { toolCallId }) => {
      writer.write({
        id: toolCallId,
        type: "data-web-search",
        data: { query, status: "loading", sources: [] },
      });

      try {
        const response = await app.search(query, {
          limit: 5,
          sources: ["web", "news"],
          scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
          timeout: 5000, // 5 second timeout
        });

        // Process web results first (higher priority)
        const web =
          response.web?.map((result) => {
            const title = ("title" in result ? result.title : "") || "";
            const description =
              ("description" in result ? result.description : "") || "";
            const url = ("url" in result ? result.url : "") || "";

            const processedContent = selectRelevantContent({
              content: ("markdown" in result ? result.markdown : "") || "",
              query, // Use the search query for relevance scoring
              preserveStructure: false, // Focus on relevance over structure
            });

            return {
              title,
              description,
              url,
              content: processedContent,
            };
          }) || [];

        // Collect URLs from web results to avoid duplicates
        const webUrls = new Set(web.map((item) => item.url).filter(Boolean));

        // Process news results, excluding URLs already in web results
        const news =
          response.news
            ?.filter((result) => {
              const url = ("url" in result ? result.url : "") || "";
              return url && !webUrls.has(url);
            })
            .map((result) => {
              const title = ("title" in result ? result.title : "") || "";
              const description =
                ("snippet" in result ? result.snippet : "") || "";
              const url = ("url" in result ? result.url : "") || "";

              const processedContent = selectRelevantContent({
                content: ("markdown" in result ? result.markdown : "") || "",
                query, // Use the search query for relevance scoring
                preserveStructure: false, // Focus on relevance over structure
              });

              return {
                title,
                description,
                url,
                content: processedContent,
              };
            }) || [];

        // combine news and web into a single array
        const sources = [...web, ...news];

        // add citation to each source, make sure only include sources with a url
        const sourcesWithCitation = sources
          .filter((source) => source.url)
          .map((source) => {
            const domain = extractDomain(source.url);
            return {
              ...source,
              citation: `[${domain}](${source.url})`,
            };
          });

        writer.write({
          id: toolCallId,
          type: "data-web-search",
          data: { query, status: "done", sources: sourcesWithCitation },
        });

        return { sources: sourcesWithCitation, error: undefined };
      } catch (error) {
        writer.write({
          id: toolCallId,
          type: "data-web-search",
          data: {
            query,
            status: "error",
            sources: [],
            error: { message: `Failed to search: ${error}` },
          },
        });

        return {
          sources: [],
          error: `Failed to search: ${error}`,
        };
      }
    },
  });
};
