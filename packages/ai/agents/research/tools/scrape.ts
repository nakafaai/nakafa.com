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

interface ScrapeUrlParams {
  maxLength?: number;
  selectionQuery?: string;
  toolCallId: string;
  url: string;
  writer: UIMessageStreamWriter<MyUIMessage>;
}

/**
 * Scrapes one URL and returns structured evidence for citation checks.
 */
export const scrapeUrl = Effect.fn("research.scrapeUrl")(function* ({
  maxLength = 3000,
  selectionQuery,
  toolCallId,
  url,
  writer,
}: ScrapeUrlParams) {
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

    return { data: { url, content: "" }, error } satisfies ScrapeOutput;
  }

  const publicUrl = safeUrl.right.publicUrl;

  const { nativeMarkdown, scrapeResult } = yield* Effect.all(
    {
      nativeMarkdown: safeUrl.right.nativeFetchUrl
        ? fetchSourceMarkdown(safeUrl.right.nativeFetchUrl)
        : Effect.succeed(undefined),
      scrapeResult: Effect.tryPromise({
        try: () =>
          firecrawlApp.scrape(publicUrl, {
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
          url: publicUrl,
          status: "error",
          content: "",
          error: scrapeResult.error,
        },
      })
    );

    return {
      data: { url: publicUrl, content: "" },
      error: scrapeResult.error,
    } satisfies ScrapeOutput;
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
          url: publicUrl,
          status: "error",
          content: "",
          ...metadata,
          error: "No content found.",
        },
      })
    );

    return {
      data: { url: publicUrl, content: "", ...metadata },
      error: "No content found.",
    } satisfies ScrapeOutput;
  }

  const processedContent = selectRelevantContent({
    content: markdown,
    maxLength,
    query: selectionQuery,
  });

  yield* Effect.sync(() =>
    writer.write({
      id: toolCallId,
      type: "data-scrape-url",
      data: {
        url: publicUrl,
        status: "done",
        content: processedContent,
        ...metadata,
      },
    })
  );

  return {
    data: {
      url: publicUrl,
      content: processedContent,
      ...metadata,
    },
    error: undefined,
  } satisfies ScrapeOutput;
});

/** Checks whether a scrape output can be cited by synthesis. */
export function isSuccessfulScrapeOutput(output: ScrapeOutput) {
  return !output.error && output.data.content.trim().length > 0;
}

/**
 * Formats scrape output as markdown for the research agent.
 */
export function formatScrapeOutput(output: ScrapeOutput) {
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
