import { tool, type UIMessageStreamWriter } from "ai";
import { selectRelevantContent } from "../lib/content-selection";
import { firecrawlApp } from "../lib/firecrawl";
import { extractDomain } from "../lib/utils";
import { nakafaWebSearch } from "../prompt/web-search";
import { webSearchInputSchema } from "../schema/tools";
import type { MyUIMessage } from "../types/message";

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createWebSearch = ({ writer }: Params) => {
  return tool({
    name: "webSearch",
    description: nakafaWebSearch(),
    inputSchema: webSearchInputSchema,
    execute: async ({ query }, { toolCallId }) => {
      writer.write({
        id: toolCallId,
        type: "data-web-search",
        data: { query, status: "loading", sources: [] },
      });

      try {
        const response = await firecrawlApp.search(query, {
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
