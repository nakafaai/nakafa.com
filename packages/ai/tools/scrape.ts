import { selectRelevantContent } from "@repo/ai/lib/content-selection";
import { firecrawlApp } from "@repo/ai/lib/firecrawl";
import { nakafaScrape } from "@repo/ai/prompt/scrape";
import { scrapeInputSchema } from "@repo/ai/schema/tools";
import type { MyUIMessage } from "@repo/ai/types/message";
import { tool, type UIMessageStreamWriter } from "ai";

type Params = {
  writer: UIMessageStreamWriter<MyUIMessage>;
};

export const createScrape = ({ writer }: Params) => {
  return tool({
    name: "scrape",
    description: nakafaScrape(),
    inputSchema: scrapeInputSchema,
    execute: async ({ urlToCrawl }, { toolCallId }) => {
      const url = urlToCrawl;

      writer.write({
        id: toolCallId,
        type: "data-scrape-url",
        data: { url, status: "loading", content: "" },
      });

      try {
        const response = await firecrawlApp.scrape(url, {
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
