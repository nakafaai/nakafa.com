import type { CapabilityProgress } from "@repo/backend/confect/nina/capability/progress";
import { readFirecrawlApp } from "@repo/backend/confect/nina/research/provider";
import {
  ResearchScrapeError,
  type ScrapeOutput,
} from "@repo/backend/confect/nina/research/schema";
import { selectRelevantContent } from "@repo/backend/confect/nina/research/selection";
import { fetchSourceMarkdown } from "@repo/backend/confect/nina/research/tools/markdown";
import { getDocumentMetadata } from "@repo/backend/confect/nina/research/tools/metadata";
import { assertPublicResearchUrl } from "@repo/backend/confect/nina/research/tools/safety";
import dedent from "dedent";
import { Effect, Result } from "effect";
/**
 * Scrapes one URL and returns structured evidence for citation checks.
 */
export const scrapeUrl = Effect.fn("research.scrapeUrl")(function* ({
  maxLength = 3000,
  selectionQuery,
  toolCallId,
  url,
  publish,
}: {
  readonly maxLength?: number;
  readonly selectionQuery?: string;
  readonly toolCallId: string;
  readonly url: string;
  readonly publish: CapabilityProgress;
}) {
  yield* publish({
    id: toolCallId,
    type: "data-scrape-url",
    data: { url, status: "loading", content: "" },
  });
  const safeUrl = yield* Effect.result(assertPublicResearchUrl(url));
  if (Result.isFailure(safeUrl)) {
    const error = safeUrl.failure.message;
    yield* publish({
      id: toolCallId,
      type: "data-scrape-url",
      data: {
        url,
        status: "error",
        content: "",
        error,
      },
    });
    return { data: { url, content: "" }, error } satisfies ScrapeOutput;
  }
  const publicUrl = safeUrl.success.publicUrl;
  const { nativeMarkdown, scrapeResult } = yield* Effect.all(
    {
      nativeMarkdown: safeUrl.success.nativeFetchUrl
        ? fetchSourceMarkdown(safeUrl.success.nativeFetchUrl)
        : Effect.as(Effect.void, undefined),
      scrapeResult: readFirecrawlApp().pipe(
        Effect.flatMap((client) =>
          Effect.tryPromise({
            try: () =>
              client.scrape(publicUrl, {
                formats: ["markdown"],
                timeout: 5000,
              }),
            catch: () =>
              new ResearchScrapeError({
                message: "The page could not be retrieved. Please try again.",
              }),
          })
        ),
        Effect.match({
          onFailure: (error) => ({ error: error.message }),
          onSuccess: (response) => ({ response }),
        })
      ),
    },
    { concurrency: "unbounded" }
  );
  if ("error" in scrapeResult && !nativeMarkdown) {
    yield* publish({
      id: toolCallId,
      type: "data-scrape-url",
      data: {
        url: publicUrl,
        status: "error",
        content: "",
        error: scrapeResult.error,
      },
    });
    return {
      data: { url: publicUrl, content: "" },
      error: scrapeResult.error,
    } satisfies ScrapeOutput;
  }
  let markdown = nativeMarkdown;
  let metadata = {};
  if ("response" in scrapeResult) {
    markdown ??= scrapeResult.response.markdown;
    metadata = getDocumentMetadata({
      ...(scrapeResult.response.metadata === undefined
        ? {}
        : { metadata: scrapeResult.response.metadata }),
    });
  }
  if (!markdown) {
    yield* publish({
      id: toolCallId,
      type: "data-scrape-url",
      data: {
        url: publicUrl,
        status: "error",
        content: "",
        ...metadata,
        error: "No content found.",
      },
    });
    return {
      data: { url: publicUrl, content: "", ...metadata },
      error: "No content found.",
    } satisfies ScrapeOutput;
  }
  const processedContent = selectRelevantContent({
    content: markdown,
    maxLength,
    ...(selectionQuery === undefined ? {} : { query: selectionQuery }),
  });
  yield* publish({
    id: toolCallId,
    type: "data-scrape-url",
    data: {
      url: publicUrl,
      status: "done",
      content: processedContent,
      ...metadata,
    },
  });
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
