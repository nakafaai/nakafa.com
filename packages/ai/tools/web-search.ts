import { firecrawlApp } from "@repo/ai/clients/firecrawl";
import { selectRelevantContent } from "@repo/ai/lib/content-selection";
import { dedentString, extractDomain } from "@repo/ai/lib/utils";
import { nakafaWebSearch } from "@repo/ai/prompt/tools/web-search";
import {
  type WebSearchOutput,
  webSearchInputSchema,
} from "@repo/ai/schema/tools/web";
import type { MyUIMessage } from "@repo/ai/types/message";
import { tool, type UIMessageStreamWriter } from "ai";
import * as z from "zod";

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export const createWebSearch = ({ writer }: Params) => {
  return tool({
    description: nakafaWebSearch(),
    inputSchema: webSearchInputSchema,
    outputSchema: z.string(),
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
          scrapeOptions: {
            formats: ["markdown"],
            onlyMainContent: true,
            // https://docs.firecrawl.dev/features/search#cost-implications
            parsers: [], // no need pdf parsers
          },
          timeout: 10_000, // 10 second timeout
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

        return createOutput({
          output: { sources: sourcesWithCitation, error: undefined },
        });
      } catch (error) {
        writer.write({
          id: toolCallId,
          type: "data-web-search",
          data: {
            query,
            status: "error",
            sources: [],
            error: `Failed to search: ${error}`,
          },
        });

        return createOutput({
          output: { sources: [], error: `Failed to search: ${error}` },
        });
      }
    },
  });
};

function createOutput({ output }: { output: WebSearchOutput }): string {
  return dedentString(`
    # Web Search Results
    ${output.error ? `- Error: ${output.error}` : ""}

    ${output.sources
      .map(
        (source, index) => `
    ## Source ${index + 1}: ${source.title}
    - URL: ${source.url}
    - Citation: ${source.citation}
    - Description: ${source.description}

    ### Content
    ${source.content}`
      )
      .join("\n\n")}
  `);
}
