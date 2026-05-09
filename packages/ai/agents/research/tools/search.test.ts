import { searchWeb } from "@repo/ai/agents/research/tools/search";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const firecrawlApp = vi.hoisted(() => ({
  search: vi.fn(),
}));

vi.mock("@repo/ai/config/firecrawl", () => ({
  firecrawlApp,
}));

vi.mock("@repo/ai/lib/selection", () => ({
  selectRelevantContent: ({
    content,
  }: {
    content: string;
    preserveStructure: boolean;
    query: string;
  }) => content,
}));

vi.mock("@repo/ai/lib/utils", () => ({
  extractDomain: (url: string) => {
    const hostname = new URL(url).hostname;

    if (hostname.startsWith("www.")) {
      return hostname.slice(4);
    }

    return hostname;
  },
}));

type WrittenPart = Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0];

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

describe("research web search tool", () => {
  beforeEach(() => {
    firecrawlApp.search.mockReset();
  });

  it("writes loading and done parts while returning text and structured sources", async () => {
    firecrawlApp.search.mockResolvedValue({
      news: [
        {
          snippet: "Duplicate source.",
          title: "Duplicate News",
          url: "https://example.com/research",
        },
        {
          markdown: "Unique news content.",
          snippet: "Unique source.",
          title: "Unique News",
          url: "https://news.example.com/update",
        },
        {
          url: "https://news.example.com/without-title",
        },
        {
          snippet: "No URL source.",
          title: "No URL News",
        },
      ],
      web: [
        {
          description: "Main source.",
          markdown: "Main source content.",
          title: "Main Source",
          url: "https://example.com/research",
        },
        {
          description: "Missing URL source.",
          markdown: "Missing URL content.",
          title: "Missing URL Source",
        },
        {
          url: "https://example.com/without-metadata",
        },
      ],
    });
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        query: "latest solar energy research",
        toolCallId: "web-search-1",
        writer,
      })
    );

    expect(output.text).toContain("# Web Search Results");
    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://example.com/research",
      "https://example.com/without-metadata",
      "https://news.example.com/update",
      "https://news.example.com/without-title",
    ]);
    expect(parts).toEqual([
      expect.objectContaining({
        type: "data-web-search",
        data: expect.objectContaining({ status: "loading" }),
      }),
      expect.objectContaining({
        type: "data-web-search",
        data: expect.objectContaining({
          sources: expect.arrayContaining([
            expect.objectContaining({
              citation: "[example.com](https://example.com/research)",
            }),
          ]),
          status: "done",
        }),
      }),
    ]);
  });

  it("writes an empty done part when Firecrawl returns no result groups", async () => {
    firecrawlApp.search.mockResolvedValue({});
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        query: "latest solar energy research",
        toolCallId: "web-search-empty",
        writer,
      })
    );

    expect(output.result.sources).toEqual([]);
    expect(output.text).toContain("# Web Search Results");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        type: "data-web-search",
        data: expect.objectContaining({ status: "done", sources: [] }),
      })
    );
  });

  it("writes an error part when Firecrawl search fails", async () => {
    firecrawlApp.search.mockRejectedValue(new Error("offline"));
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        query: "latest solar energy research",
        toolCallId: "web-search-2",
        writer,
      })
    );

    expect(output.result.sources).toEqual([]);
    expect(output.result.error).toContain("Failed to search");
    expect(output.text).toContain("Failed to search");
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        type: "data-web-search",
        data: expect.objectContaining({ status: "error" }),
      })
    );
  });
});
