import { nakafaWebSearch } from "@repo/ai/agents/research/descriptions";
import {
  type WebSearchOutput,
  webSearchInputSchema,
} from "@repo/ai/agents/research/schema";
import { firecrawlApp } from "@repo/ai/config/firecrawl";
import { selectRelevantContent } from "@repo/ai/lib/content-selection";
import { dedentString, extractDomain } from "@repo/ai/lib/utils";
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
            parsers: [],
          },
          timeout: 10_000,
        });

        const web =
          response.web?.map((result) => {
            const title = ("title" in result ? result.title : "") || "";
            const description =
              ("description" in result ? result.description : "") || "";
            const url = ("url" in result ? result.url : "") || "";

            const processedContent = selectRelevantContent({
              content: ("markdown" in result ? result.markdown : "") || "",
              query,
              preserveStructure: false,
            });

            return {
              title,
              description,
              url,
              content: processedContent,
            };
          }) || [];

        const webUrls = new Set(web.map((item) => item.url).filter(Boolean));

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
                query,
                preserveStructure: false,
              });

              return {
                title,
                description,
                url,
                content: processedContent,
              };
            }) || [];

        const sources = [...web, ...news];

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
