import { purposes } from "@repo/backend/confect/gateway/purpose";
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
import { Duration, Effect, Result, Schema } from "effect";

/**
 * How long one page read may take, in milliseconds. `timeoutMs` is the
 * provider's own limit. With `autoResume: false` the Firecrawl SDK surfaces
 * that limit at once, and it retries a 502 up to two more times, so
 * `deadlineMs` is the backstop for the whole read.
 */
const PageLimits = Schema.Struct({
  deadlineMs: Schema.Finite,
  timeoutMs: Schema.Finite,
});

/**
 * A link the learner gave is the point of the question, so its read gets the
 * step budget of the specialist purpose that runs research. Measured on 10
 * October 2026, single page reads took 0.9 to 5.7 seconds.
 */
const LEARNER_LINK = {
  deadlineMs: purposes.specialist.timeout.stepMs,
  timeoutMs: 15_000,
};

const scrapeFailure = () =>
  new ResearchScrapeError({
    message: "The page could not be retrieved. Please try again.",
  });

/**
 * Reads one page as markdown without telling the learner: the page's own
 * markdown form when it has one, else the provider's. A result without
 * `markdown` carries the `error`: the address is not public, the page could
 * not be retrieved in time, or it had no text.
 */
export const readPage = Effect.fn("research.readPage")(function* (
  url: string,
  limits: typeof PageLimits.Type
) {
  const safeUrl = yield* Effect.result(assertPublicResearchUrl(url));
  if (Result.isFailure(safeUrl)) {
    return { error: safeUrl.failure.message, metadata: {}, url };
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
                autoResume: false,
                formats: ["markdown"],
                timeout: limits.timeoutMs,
              }),
            catch: scrapeFailure,
          }).pipe(
            Effect.timeoutOrElse({
              duration: Duration.millis(limits.deadlineMs),
              orElse: () => Effect.fail(scrapeFailure()),
            })
          )
        ),
        Effect.match({
          onFailure: (error) => ({ error: error.message }),
          onSuccess: (response) => ({ response }),
        })
      ),
    },
    { concurrency: "unbounded" }
  );
  if ("error" in scrapeResult) {
    return nativeMarkdown
      ? { markdown: nativeMarkdown, metadata: {}, url: publicUrl }
      : { error: scrapeResult.error, metadata: {}, url: publicUrl };
  }
  const metadata = getDocumentMetadata({
    ...(scrapeResult.response.metadata === undefined
      ? {}
      : { metadata: scrapeResult.response.metadata }),
  });
  const markdown = nativeMarkdown ?? scrapeResult.response.markdown;
  return markdown
    ? { markdown, metadata, url: publicUrl }
    : { error: "No content found.", metadata, url: publicUrl };
});

/**
 * Reads one link the learner gave and shows its card: loading, then the
 * selected text or the reason the page could not be read.
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
  const page = yield* readPage(url, LEARNER_LINK);
  if (!("markdown" in page)) {
    yield* publish({
      id: toolCallId,
      type: "data-scrape-url",
      data: {
        url: page.url,
        status: "error",
        content: "",
        ...page.metadata,
        error: page.error,
      },
    });
    return {
      data: { url: page.url, content: "", ...page.metadata },
      error: page.error,
    } satisfies ScrapeOutput;
  }
  const processedContent = selectRelevantContent({
    content: page.markdown,
    maxLength,
    ...(selectionQuery === undefined ? {} : { query: selectionQuery }),
  });
  yield* publish({
    id: toolCallId,
    type: "data-scrape-url",
    data: {
      url: page.url,
      status: "done",
      content: processedContent,
      ...page.metadata,
    },
  });
  return {
    data: {
      url: page.url,
      content: processedContent,
      ...page.metadata,
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
