import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  formatScrapeOutput,
  isSuccessfulScrapeOutput,
  readPage,
  scrapeUrl,
} from "@repo/backend/confect/nina/research/tools/scrape";
import { withTimeLeft } from "@repo/backend/test/nina/deadline";
import { createProgress } from "@repo/backend/test/nina/progress";
import {
  inBackground,
  overProvider,
  providerScrapeUrl,
  scrapeAnswer,
  sentBodies,
} from "@repo/backend/test/nina/provider";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Fiber, Option } from "effect";
import { TestClock } from "effect/testing";

const lookup = vi.hoisted(() => vi.fn());
const selectRelevantContent = vi.hoisted(() =>
  vi.fn(({ content }: { content: string; query?: string }) => content)
);

vi.mock("node:dns/promises", () => ({
  lookup,
}));

vi.mock("@repo/backend/confect/nina/research/selection", () => ({
  selectRelevantContent,
}));

/**
 * The fetch that Effect's client calls in place of the global one. A page read
 * makes two kinds of request through it: the provider's POST, and a GET for the
 * page's own markdown when the page has a public IP address.
 */
const fetcher = vi.fn<typeof fetch>();
const overFetch = overProvider(fetcher);

const notFound = () => Promise.resolve(new Response("", { status: 404 }));

/** A request that nothing answers. */
const never = () => new Promise<Response>(() => undefined);

/** Markdown that a page serves for itself. */
const markdownResponse = (text: string) =>
  Promise.resolve(
    new Response(text, { headers: { "content-type": "text/markdown" } })
  );

/**
 * Answers the provider's scrape endpoint with `answer`, and the address of any
 * other request with `others`, which is a 404 unless a test says otherwise.
 */
function route(
  answer: () => Promise<Response>,
  others: (url: string) => Promise<Response> = notFound
) {
  fetcher.mockImplementation((input) =>
    String(input) === providerScrapeUrl.href ? answer() : others(String(input))
  );
}

/** Makes the provider read this page. */
function readsPage(data: object, others?: (url: string) => Promise<Response>) {
  route(() => Promise.resolve(scrapeAnswer(data)), others);
}

/** The address of every request the fetch double was given, in order. */
const requested = () => Arr.map(fetcher.mock.calls, ([input]) => String(input));

/** Reads a link the learner gave, and keeps the cards it published. */
function readLink(
  url: string,
  options: Pick<
    Parameters<typeof scrapeUrl>[0],
    "maxLength" | "selectionQuery"
  > = {}
) {
  const { parts, publish } = createProgress();
  return scrapeUrl({ ...options, toolCallId: "scrape", url, publish }).pipe(
    overFetch,
    Effect.map((output) => ({ output, parts }))
  );
}

describe("research scrape tool", () => {
  beforeEach(() => {
    lookup.mockReset();
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    selectRelevantContent.mockClear();
    fetcher.mockReset();
    fetcher.mockImplementation(notFound);
  });

  it.effect("keeps Firecrawl metadata in tool text and UI data", () =>
    Effect.gen(function* () {
      readsPage({
        markdown: "# DevTools",
        metadata: {
          description: "Debug and inspect AI SDK applications with DevTools",
          favicon: "https://ai-sdk.dev/favicon.ico",
          title: "AI SDK Core: DevTools",
        },
      });

      const { output, parts } = yield* readLink(
        "https://ai-sdk.dev/docs/ai-sdk-core/devtools"
      );
      const text = formatScrapeOutput(output);

      expect(text).toContain("- Title: AI SDK Core: DevTools");
      expect(text).toContain(
        "- Description: Debug and inspect AI SDK applications with DevTools"
      );
      // A page with a host name is read by the provider alone.
      expect(requested()).toEqual([providerScrapeUrl.href]);
      expect(yield* sentBodies(fetcher)).toMatchObject([
        {
          formats: ["markdown"],
          url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        },
      ]);
      expect(parts()).toEqual([
        expect.objectContaining({
          type: "data-scrape-url",
          data: expect.objectContaining({ status: "loading" }),
        }),
        expect.objectContaining({
          type: "data-scrape-url",
          data: expect.objectContaining({
            content: "# DevTools",
            description: "Debug and inspect AI SDK applications with DevTools",
            favicon: "https://ai-sdk.dev/favicon.ico",
            status: "done",
            title: "AI SDK Core: DevTools",
          }),
        }),
      ]);
    })
  );

  it.effect(
    "ends a scrape that never answers at the specialist step deadline",
    () =>
      Effect.gen(function* () {
        route(never);
        const fiber = yield* inBackground(
          readLink("https://ai-sdk.dev/docs/ai-sdk-core/devtools")
        );

        // The specialist step allows 30 seconds, and the scrape waits for all of it.
        yield* TestClock.adjust("29999 millis");
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("1 millis");

        const { output, parts } = yield* Fiber.join(fiber);
        expect(parts()).toHaveLength(2);
        expect(output.error).toBe(
          "The page could not be retrieved. Please try again."
        );
        expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      })
  );

  it.effect(
    "gives a result page its own shorter limits and reports an unread page without a card",
    () =>
      Effect.gen(function* () {
        route(never);
        const fiber = yield* inBackground(
          readPage("https://example.com/slow", {
            deadlineMs: 10_000,
            timeoutMs: 8000,
          }).pipe(overFetch)
        );
        yield* TestClock.adjust("9999 millis");
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("1 millis");
        expect(yield* Fiber.join(fiber)).toEqual({
          error: "The page could not be retrieved. Please try again.",
          metadata: {},
          url: "https://example.com/slow",
        });
        expect(yield* sentBodies(fetcher)).toEqual([
          {
            url: "https://example.com/slow",
            formats: ["markdown"],
            timeout: 8000,
          },
        ]);
      })
  );

  it.effect("cuts a page read to the time the capability has left", () =>
    Effect.gen(function* () {
      // Both ways of reading hang, so only the time left can end the read.
      const url = "https://93.184.216.34/docs/current";
      fetcher.mockImplementation(never);
      const fiber = yield* inBackground(
        readPage(url, { deadlineMs: 30_000, timeoutMs: 15_000 }).pipe(
          overFetch,
          withTimeLeft("4 seconds")
        )
      );
      yield* TestClock.adjust("3999 millis");
      expect(fiber.pollUnsafe()).toBeUndefined();
      yield* TestClock.adjust("1 millis");
      expect(yield* Fiber.join(fiber)).toEqual({
        error: "The page could not be retrieved. Please try again.",
        metadata: {},
        url,
      });
      expect(requested()).toContain(providerScrapeUrl.href);
      expect(yield* sentBodies(fetcher)).toMatchObject([{ timeout: 4000 }]);
    })
  );

  it.effect("rejects private scrape targets before fetching or crawling", () =>
    Effect.gen(function* () {
      const { output, parts } = yield* readLink("http://localhost:3000/admin");
      const text = formatScrapeOutput(output);

      expect(text).toContain("Only public http(s) URLs can be scraped");
      expect(fetcher).not.toHaveBeenCalled();
      expect(parts()).toEqual([
        expect.objectContaining({
          type: "data-scrape-url",
          data: expect.objectContaining({ status: "loading" }),
        }),
        expect.objectContaining({
          type: "data-scrape-url",
          data: expect.objectContaining({
            content: "",
            status: "error",
            url: "http://localhost:3000/admin",
          }),
        }),
      ]);
    })
  );

  it.effect("rejects public hostnames that resolve to private addresses", () =>
    Effect.gen(function* () {
      lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);

      yield* readLink("https://example.com/internal");

      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("prefers source-native markdown for IP-literal URLs", () =>
    Effect.gen(function* () {
      readsPage(
        {
          markdown: "Search...\n\n# DevTools\n\n[Sign Up](https://vercel.com)",
          metadata: {
            description: "Debug and inspect AI SDK applications with DevTools",
            title: "AI SDK Core: DevTools",
          },
        },
        (url) =>
          url === "https://93.184.216.34/docs/ai-sdk-core/devtools.md"
            ? markdownResponse(
                "# DevTools\n\nAI SDK DevTools gives you full visibility over your AI SDK calls with generateText, streamText, and ToolLoopAgent."
              )
            : Promise.resolve(
                new Response("<html>docs shell</html>", {
                  headers: { "content-type": "text/html" },
                })
              )
      );

      const { output, parts } = yield* readLink(
        "https://93.184.216.34/docs/ai-sdk-core/devtools"
      );
      const text = formatScrapeOutput(output);

      expect(text).toContain("full visibility over your AI SDK calls");
      expect(text).not.toContain("Sign Up");
      expect(Option.getOrThrow(Arr.last(parts()))).toEqual(
        expect.objectContaining({
          type: "data-scrape-url",
          data: expect.objectContaining({
            content: expect.stringContaining(
              "full visibility over your AI SDK calls"
            ),
            description: "Debug and inspect AI SDK applications with DevTools",
            status: "done",
            title: "AI SDK Core: DevTools",
          }),
        })
      );
    })
  );

  it.effect("keeps source-native markdown when Firecrawl scrape fails", () =>
    Effect.gen(function* () {
      route(
        () => Promise.reject(new Error("offline")),
        () => markdownResponse("# Native source\n\nDirect markdown evidence.")
      );

      const { output, parts } = yield* readLink(
        "https://93.184.216.34/docs/current"
      );

      expect(output.error).toBeUndefined();
      expect(output.data.content).toContain("Direct markdown evidence.");
      expect(Option.getOrThrow(Arr.last(parts()))).toEqual(
        expect.objectContaining({
          type: "data-scrape-url",
          data: expect.objectContaining({
            content: expect.stringContaining("Direct markdown evidence."),
            status: "done",
          }),
        })
      );
    })
  );

  it.effect(
    "falls back to alternate metadata fields when markdown is missing",
    () =>
      Effect.gen(function* () {
        readsPage({
          metadata: {
            dcDescription: "Fallback description",
            ogTitle: "Fallback title",
          },
        });

        const { output, parts } = yield* readLink(
          "https://example.com/missing-markdown"
        );
        const text = formatScrapeOutput(output);

        expect(text).toContain("- Title: Fallback title");
        expect(text).toContain("- Description: Fallback description");
        expect(text).toContain("- Error: No content found.");
        expect(Option.getOrThrow(Arr.last(parts()))).toEqual(
          expect.objectContaining({
            type: "data-scrape-url",
            data: expect.objectContaining({
              description: "Fallback description",
              error: "No content found.",
              status: "error",
              title: "Fallback title",
            }),
          })
        );
      })
  );

  it.effect("keeps scrape output valid when metadata is unavailable", () =>
    Effect.gen(function* () {
      readsPage({ markdown: "# Plain source" });

      const { output, parts } = yield* readLink("https://example.com/plain");
      const text = formatScrapeOutput(output);

      expect(text).not.toContain("- Title:");
      expect(text).not.toContain("- Description:");
      expect(Option.getOrThrow(Arr.last(parts()))).toEqual(
        expect.objectContaining({
          type: "data-scrape-url",
          data: {
            content: "# Plain source",
            status: "done",
            url: "https://example.com/plain",
          },
        })
      );
    })
  );

  it.effect("passes the selection query to relevant content selection", () =>
    Effect.gen(function* () {
      readsPage({
        markdown: "# DevTools\n\nUse AI SDK DevTools for local debugging.",
      });

      yield* readLink("https://ai-sdk.dev/docs/ai-sdk-core/devtools", {
        selectionQuery: "AI SDK DevTools local debugging",
      });

      expect(selectRelevantContent).toHaveBeenCalledWith(
        expect.objectContaining({
          maxLength: 3000,
          query: "AI SDK DevTools local debugging",
        })
      );
    })
  );

  it.effect("allows exact-source callers to keep more source evidence", () =>
    Effect.gen(function* () {
      readsPage({
        markdown: "# DevTools\n\nUse AI SDK DevTools for local debugging.",
      });

      yield* readLink("https://ai-sdk.dev/docs/ai-sdk-core/devtools", {
        maxLength: 8000,
        selectionQuery: "AI SDK DevTools local debugging",
      });

      expect(selectRelevantContent).toHaveBeenCalledWith(
        expect.objectContaining({
          maxLength: 8000,
          query: "AI SDK DevTools local debugging",
        })
      );
    })
  );

  it.effect("writes an error part when Firecrawl scrape fails", () =>
    Effect.gen(function* () {
      route(() => Promise.reject(new Error("offline")));

      const { output, parts } = yield* readLink("https://example.com/offline");
      const text = formatScrapeOutput(output);

      expect(text).toContain(
        "The page could not be retrieved. Please try again."
      );
      expect(text).not.toContain("- Title:");
      expect(Option.getOrThrow(Arr.last(parts()))).toEqual(
        expect.objectContaining({
          type: "data-scrape-url",
          data: expect.objectContaining({ status: "error" }),
        })
      );
    })
  );

  it.effect(
    "does not wait for a page that the provider says it is still processing",
    () =>
      Effect.gen(function* () {
        route(() =>
          Promise.resolve(
            new Response(
              encodeJsonText({
                code: "SCRAPE_TIMEOUT",
                details: {
                  retryAfterSeconds: 30,
                  state: "processing_continues",
                },
                error: "Scrape timed out",
                success: false,
              }),
              { headers: { "retry-after": "30" }, status: 408 }
            )
          )
        );

        const { output } = yield* readLink("https://example.com/large.pdf");

        expect(output.error).toBe(
          "The page could not be retrieved. Please try again."
        );
        expect(fetcher).toHaveBeenCalledOnce();
      })
  );

  it("recognizes successful scrape evidence", () => {
    expect(
      isSuccessfulScrapeOutput({
        data: {
          content: "# Source",
          url: "https://example.com/source",
        },
        error: undefined,
      })
    ).toBe(true);
    expect(
      isSuccessfulScrapeOutput({
        data: {
          content: "",
          url: "https://example.com/source",
        },
        error: "No content found.",
      })
    ).toBe(false);
  });
});
