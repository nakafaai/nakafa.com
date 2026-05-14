import {
  ResearchScrapeError,
  type ScrapeOutput,
} from "@repo/ai/agents/research/schema";
import { getDocumentMetadata } from "@repo/ai/agents/research/tools/metadata";
import { firecrawlApp } from "@repo/ai/config/firecrawl";
import { selectRelevantContent } from "@repo/ai/lib/selection";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import dedent from "dedent";
import { Effect } from "effect";

/**
 * Scrapes one URL and writes the scrape UI data part.
 */
export const scrapeUrl = Effect.fn("research.scrapeUrl")(function* ({
  toolCallId,
  url,
  writer,
}: {
  toolCallId: string;
  url: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}) {
  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-scrape-url",
      data: { url, status: "loading", content: "" },
    })
  );

  const scrapeResult = yield* Effect.tryPromise({
    try: () =>
      firecrawlApp.scrape(url, {
        formats: ["markdown"],
        timeout: 5000,
      }),
    catch: (error) =>
      new ResearchScrapeError({ message: `Failed to crawl: ${error}` }),
  }).pipe(
    Effect.match({
      onFailure: (error) => ({ error: error.message }),
      onSuccess: (response) => ({ response }),
    })
  );

  if ("error" in scrapeResult) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-scrape-url",
        data: {
          url,
          status: "error",
          content: "",
          error: scrapeResult.error,
        },
      })
    );

    return formatOutput({
      output: { data: { url, content: "" }, error: scrapeResult.error },
    });
  }

  const markdown = scrapeResult.response.markdown;
  const metadata = getDocumentMetadata({
    metadata: scrapeResult.response.metadata,
  });

  if (!markdown) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-scrape-url",
        data: {
          url,
          status: "error",
          content: "",
          ...metadata,
          error: "No content found.",
        },
      })
    );

    return formatOutput({
      output: {
        data: { url, content: "", ...metadata },
        error: "No content found.",
      },
    });
  }

  const processedContent = selectRelevantContent({
    content: markdown,
    maxLength: 3000,
  });

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-scrape-url",
      data: { url, status: "done", content: processedContent, ...metadata },
    })
  );

  return formatOutput({
    output: {
      data: {
        url,
        content: processedContent,
        ...metadata,
      },
      error: undefined,
    },
  });
});

/**
 * Formats scrape output as markdown for the research agent.
 */
function formatOutput({ output }: { output: ScrapeOutput }) {
  return dedent(`
    # Scrape Result
    - URL: ${output.data.url}
    ${output.data.title ? `- Title: ${output.data.title}` : ""}
    ${output.data.description ? `- Description: ${output.data.description}` : ""}
    ${output.error ? `- Error: ${output.error}` : ""}

    ## Content
    ${output.data.content}
  `);
}
