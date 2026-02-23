import { firecrawlApp } from "@repo/ai/config/firecrawl";
import { selectRelevantContent } from "@repo/ai/lib/content-selection";
import { dedentString } from "@repo/ai/lib/utils";
import { nakafaScrape } from "@repo/ai/prompt/tools/scrape";
import {
  type ScrapeOutput,
  scrapeInputSchema,
} from "@repo/ai/schema/tools/web";
import type { MyUIMessage } from "@repo/ai/types/message";
import { tool, type UIMessageStreamWriter } from "ai";
import * as z from "zod";

interface Params {
  writer: UIMessageStreamWriter<MyUIMessage>;
}

export const createScrape = ({ writer }: Params) => {
  return tool({
    description: nakafaScrape(),
    inputSchema: scrapeInputSchema,
    outputSchema: z.string(),
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
          timeout: 5000,
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
              error: "No content found.",
            },
          });

          return createOutput({
            output: { data: { url, content: "" }, error: "No content found." },
          });
        }

        const processedContent = selectRelevantContent({
          content: markdown,
          maxLength: 3000,
        });

        writer.write({
          id: toolCallId,
          type: "data-scrape-url",
          data: { url, status: "done", content: processedContent },
        });

        return createOutput({
          output: {
            data: {
              url,
              content: processedContent,
            },
            error: undefined,
          },
        });
      } catch (error) {
        const errorMessage = `Failed to crawl: ${error}`;
        writer.write({
          id: toolCallId,
          type: "data-scrape-url",
          data: {
            url,
            status: "error",
            content: "",
            error: errorMessage,
          },
        });

        return createOutput({
          output: { data: { url, content: "" }, error: errorMessage },
        });
      }
    },
  });
};

function createOutput({ output }: { output: ScrapeOutput }): string {
  return dedentString(`
    # Scrape Result
    - URL: ${output.data.url}
    ${output.error ? `- Error: ${output.error}` : ""}

    ## Content
    ${output.data.content}
  `);
}
