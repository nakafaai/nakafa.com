import type { ScrapeOutput } from "@repo/ai/agents/research/schema";
import { firecrawlApp } from "@repo/ai/config/firecrawl";
import { selectRelevantContent } from "@repo/ai/lib/selection";
import { dedentString } from "@repo/ai/lib/utils";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
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
    catch: (error) => new Error(`Failed to crawl: ${error}`),
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

  if (!markdown) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-scrape-url",
        data: {
          url,
          status: "error",
          content: "",
          error: "No content found.",
        },
      })
    );

    return formatOutput({
      output: { data: { url, content: "" }, error: "No content found." },
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
      data: { url, status: "done", content: processedContent },
    })
  );

  return formatOutput({
    output: {
      data: {
        url,
        content: processedContent,
      },
      error: undefined,
    },
  });
});

/**
 * Formats scrape output as markdown for the research agent.
 */
function formatOutput({ output }: { output: ScrapeOutput }) {
  return dedentString(`
    # Scrape Result
    - URL: ${output.data.url}
    ${output.error ? `- Error: ${output.error}` : ""}

    ## Content
    ${output.data.content}
  `);
}
