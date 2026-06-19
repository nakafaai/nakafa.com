import {
  formatScrapeOutput,
  isSuccessfulScrapeOutput,
  scrapeUrl,
} from "@repo/ai/agents/research/tools/scrape";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firecrawlApp = vi.hoisted(() => ({
  scrape: vi.fn(),
}));
const lookup = vi.hoisted(() => vi.fn());
const selectRelevantContent = vi.hoisted(() =>
  vi.fn(({ content }: { content: string; query?: string }) => content)
);

vi.mock("@repo/ai/config/firecrawl", () => ({
  readFirecrawlApp: () => firecrawlApp,
}));

vi.mock("node:dns/promises", () => ({
  lookup,
}));

vi.mock("@repo/ai/lib/selection", () => ({
  selectRelevantContent,
}));

type WrittenPart = Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0];

/** Creates a stream writer harness that records scrape data parts for assertions. */
function createWriter() {
  const parts: WrittenPart[] = [];
  const writer = {
    merge: () => undefined,
    onError: undefined,
    write: (part) => {
      parts.push(part);
    },
  } satisfies UIMessageStreamWriter<MyUIMessage>;

  return { parts, writer };
}

describe("research scrape tool", () => {
  beforeEach(() => {
    firecrawlApp.scrape.mockReset();
    lookup.mockReset();
    lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    selectRelevantContent.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("", { status: 404 })))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps Firecrawl metadata in tool text and UI data", async () => {
    firecrawlApp.scrape.mockResolvedValue({
      markdown: "# DevTools",
      metadata: {
        description: "Debug and inspect AI SDK applications with DevTools",
        favicon: "https://ai-sdk.dev/favicon.ico",
        title: "AI SDK Core: DevTools",
      },
    });
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-1",
        url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        writer,
      })
    );
    const text = formatScrapeOutput(output);

    expect(text).toContain("- Title: AI SDK Core: DevTools");
    expect(text).toContain(
      "- Description: Debug and inspect AI SDK applications with DevTools"
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(firecrawlApp.scrape).toHaveBeenCalledWith(
      "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
      expect.objectContaining({ formats: ["markdown"] })
    );
    expect(parts).toEqual([
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
  });

  it("rejects private scrape targets before fetching or crawling", async () => {
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-localhost",
        url: "http://localhost:3000/admin",
        writer,
      })
    );
    const text = formatScrapeOutput(output);

    expect(text).toContain("Only public http(s) URLs can be scraped");
    expect(fetch).not.toHaveBeenCalled();
    expect(firecrawlApp.scrape).not.toHaveBeenCalled();
    expect(parts).toEqual([
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
  });

  it("rejects public hostnames that resolve to private addresses", async () => {
    lookup.mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    const { writer } = createWriter();

    await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-rebound",
        url: "https://example.com/internal",
        writer,
      })
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(firecrawlApp.scrape).not.toHaveBeenCalled();
  });

  it("prefers source-native markdown for IP-literal URLs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: Parameters<typeof fetch>[0]) => {
        if (
          String(input) === "https://93.184.216.34/docs/ai-sdk-core/devtools.md"
        ) {
          return Promise.resolve(
            new Response(
              [
                "# DevTools",
                "",
                "AI SDK DevTools gives you full visibility over your AI SDK calls with generateText, streamText, and ToolLoopAgent.",
              ].join("\n"),
              {
                headers: { "content-type": "text/markdown" },
              }
            )
          );
        }

        return Promise.resolve(
          new Response("<html>docs shell</html>", {
            headers: { "content-type": "text/html" },
          })
        );
      })
    );
    firecrawlApp.scrape.mockResolvedValue({
      markdown: "Search...\n\n# DevTools\n\n[Sign Up](https://vercel.com)",
      metadata: {
        description: "Debug and inspect AI SDK applications with DevTools",
        title: "AI SDK Core: DevTools",
      },
    });
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-native",
        url: "https://93.184.216.34/docs/ai-sdk-core/devtools",
        writer,
      })
    );
    const text = formatScrapeOutput(output);

    expect(text).toContain("full visibility over your AI SDK calls");
    expect(text).not.toContain("Sign Up");
    expect(parts.at(-1)).toEqual(
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
  });

  it("keeps source-native markdown when Firecrawl scrape fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response("# Native source\n\nDirect markdown evidence.", {
            headers: { "content-type": "text/markdown" },
          })
        )
      )
    );
    firecrawlApp.scrape.mockRejectedValue(new Error("offline"));
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-native-fallback",
        url: "https://93.184.216.34/docs/current",
        writer,
      })
    );

    expect(output.error).toBeUndefined();
    expect(output.data.content).toContain("Direct markdown evidence.");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        type: "data-scrape-url",
        data: expect.objectContaining({
          content: expect.stringContaining("Direct markdown evidence."),
          status: "done",
        }),
      })
    );
  });

  it("falls back to alternate metadata fields when markdown is missing", async () => {
    firecrawlApp.scrape.mockResolvedValue({
      metadata: {
        dcDescription: "Fallback description",
        ogTitle: "Fallback title",
      },
    });
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-2",
        url: "https://example.com/missing-markdown",
        writer,
      })
    );
    const text = formatScrapeOutput(output);

    expect(text).toContain("- Title: Fallback title");
    expect(text).toContain("- Description: Fallback description");
    expect(text).toContain("- Error: No content found.");
    expect(parts.at(-1)).toEqual(
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
  });

  it("keeps scrape output valid when metadata is unavailable", async () => {
    firecrawlApp.scrape.mockResolvedValue({
      markdown: "# Plain source",
    });
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-no-metadata",
        url: "https://example.com/plain",
        writer,
      })
    );
    const text = formatScrapeOutput(output);

    expect(text).not.toContain("- Title:");
    expect(text).not.toContain("- Description:");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        type: "data-scrape-url",
        data: {
          content: "# Plain source",
          status: "done",
          url: "https://example.com/plain",
        },
      })
    );
  });

  it("passes the selection query to relevant content selection", async () => {
    firecrawlApp.scrape.mockResolvedValue({
      markdown: "# DevTools\n\nUse AI SDK DevTools for local debugging.",
    });
    const { writer } = createWriter();

    await Effect.runPromise(
      scrapeUrl({
        selectionQuery: "AI SDK DevTools local debugging",
        toolCallId: "scrape-query",
        url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        writer,
      })
    );

    expect(selectRelevantContent).toHaveBeenCalledWith(
      expect.objectContaining({
        maxLength: 3000,
        query: "AI SDK DevTools local debugging",
      })
    );
  });

  it("allows exact-source callers to keep more source evidence", async () => {
    firecrawlApp.scrape.mockResolvedValue({
      markdown: "# DevTools\n\nUse AI SDK DevTools for local debugging.",
    });
    const { writer } = createWriter();

    await Effect.runPromise(
      scrapeUrl({
        maxLength: 8000,
        selectionQuery: "AI SDK DevTools local debugging",
        toolCallId: "scrape-long-source",
        url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        writer,
      })
    );

    expect(selectRelevantContent).toHaveBeenCalledWith(
      expect.objectContaining({
        maxLength: 8000,
        query: "AI SDK DevTools local debugging",
      })
    );
  });

  it("writes an error part when Firecrawl scrape fails", async () => {
    firecrawlApp.scrape.mockRejectedValue(new Error("offline"));
    const { parts, writer } = createWriter();

    const output = await Effect.runPromise(
      scrapeUrl({
        toolCallId: "scrape-3",
        url: "https://example.com/offline",
        writer,
      })
    );
    const text = formatScrapeOutput(output);

    expect(text).toContain("Failed to crawl");
    expect(text).not.toContain("- Title:");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        type: "data-scrape-url",
        data: expect.objectContaining({ status: "error" }),
      })
    );
  });

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
