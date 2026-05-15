import {
  ResearchScrapeError,
  type ScrapeOutput,
} from "@repo/ai/agents/research/schema";
import { fetchSourceMarkdown } from "@repo/ai/agents/research/tools/markdown";
import { getDocumentMetadata } from "@repo/ai/agents/research/tools/metadata";
import { assertPublicResearchUrl } from "@repo/ai/agents/research/tools/safety";
import { firecrawlApp } from "@repo/ai/config/firecrawl";
import { selectRelevantContent } from "@repo/ai/lib/selection";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import dedent from "dedent";
import { Effect, Either } from "effect";

/**
 * Scrapes one URL and writes the scrape UI data part.
 */
export const scrapeUrl = Effect.fn("research.scrapeUrl")(function* ({
  query,
  maxLength = 3000,
  toolCallId,
  url,
  writer,
}: {
  query?: string;
  maxLength?: number;
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

  const safeUrl = yield* Effect.either(assertPublicResearchUrl(url));

  if (Either.isLeft(safeUrl)) {
    const error = safeUrl.left.message;

    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-scrape-url",
        data: {
          url,
          status: "error",
          content: "",
          error,
        },
      })
    );

    return formatOutput({
      output: { data: { url, content: "" }, error },
    });
  }

  const { nativeMarkdown, scrapeResult } = yield* Effect.all(
    {
      nativeMarkdown: fetchSourceMarkdown(safeUrl.right),
      scrapeResult: Effect.tryPromise({
        try: () =>
          firecrawlApp.scrape(safeUrl.right, {
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
      ),
    },
    { concurrency: "unbounded" }
  );

  if ("error" in scrapeResult) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-scrape-url",
        data: {
          url: safeUrl.right,
          status: "error",
          content: "",
          error: scrapeResult.error,
        },
      })
    );

    return formatOutput({
      output: {
        data: { url: safeUrl.right, content: "" },
        error: scrapeResult.error,
      },
    });
  }

  const markdown = nativeMarkdown ?? scrapeResult.response.markdown;
  const metadata = getDocumentMetadata({
    metadata: scrapeResult.response.metadata,
  });

  if (!markdown) {
    yield* Effect.sync(() =>
      writer.write({
        id: toolCallId,
        type: "data-scrape-url",
        data: {
          url: safeUrl.right,
          status: "error",
          content: "",
          ...metadata,
          error: "No content found.",
        },
      })
    );

    return formatOutput({
      output: {
        data: { url: safeUrl.right, content: "", ...metadata },
        error: "No content found.",
      },
    });
  }

  const processedContent = selectRelevantContent({
    content: markdown,
    maxLength,
    query,
  });

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-scrape-url",
      data: {
        url: safeUrl.right,
        status: "done",
        content: processedContent,
        ...metadata,
      },
    })
  );

  return formatOutput({
    output: {
      data: {
        url: safeUrl.right,
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
