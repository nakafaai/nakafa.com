import { beforeEach, describe, expect, it } from "@effect/vitest";
import { searchWeb } from "@repo/ai/agents/research/tools/search";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";

const firecrawlApp = vi.hoisted(() => ({
  search: vi.fn(),
}));

vi.mock("@repo/ai/config/firecrawl", () => ({
  readFirecrawlApp: () => firecrawlApp,
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

vi.mock("@repo/ai/lib/domain", () => ({
  extractDomain: (url: string) => {
    const hostname = new URL(url).hostname;

    if (hostname.startsWith("www.")) {
      return hostname.slice(4);
    }

    return hostname;
  },
}));

type WrittenPart = Parameters<UIMessageStreamWriter<MyUIMessage>["write"]>[0];

/** Creates a stream writer harness that records web-search data parts for assertions. */
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

/** Extracts web-search data parts from a recorded test writer stream. */
function getWebSearchParts(parts: WrittenPart[]) {
  return parts.flatMap((part) => {
    if (part.type !== "data-web-search") {
      return [];
    }

    return [part.data];
  });
}

describe("research web search tool", () => {
  beforeEach(() => {
    firecrawlApp.search.mockReset();
  });

  it.effect(
    "writes loading and done parts while returning text and structured sources",
    () =>
      Effect.gen(function* () {
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
            {
              markdown: "Document content.",
              metadata: {
                description: "Document metadata description.",
                ogTitle: "Document Metadata Title",
                sourceURL: "https://docs.example.com/document",
              },
            },
            {
              markdown: undefined,
              metadata: {
                sourceURL: "https://docs.example.com/empty",
                title: "Empty Document",
              },
            },
          ],
        });
        const { parts, writer } = createWriter();
        const output = yield* searchWeb({
          queries: ["latest solar energy research"],
          sourcePreference: "any",
          task: "latest solar energy research",
          toolCallId: "web-search-1",
          writer,
        });

        expect(output.text).toContain("# Web Search Results");
        expect(output.result.sources.map((source) => source.url)).toEqual([
          "https://example.com/research",
          "https://example.com/without-metadata",
          "https://docs.example.com/document",
          "https://docs.example.com/empty",
          "https://news.example.com/update",
          "https://news.example.com/without-title",
        ]);
        expect(output.result.sources).toContainEqual(
          expect.objectContaining({
            content: "Document content.",
            description: "Document metadata description.",
            title: "Document Metadata Title",
            url: "https://docs.example.com/document",
          })
        );
        expect(output.text).toContain(
          "- Inline citation: [example.com](https://example.com/research)"
        );
        expect(parts).toEqual([
          expect.objectContaining({
            type: "data-web-search",
            data: expect.objectContaining({ status: "loading" }),
          }),
          expect.objectContaining({
            type: "data-web-search",
            data: expect.objectContaining({
              provider: "firecrawl",
              sources: expect.arrayContaining([
                expect.objectContaining({
                  citation: "[example.com](https://example.com/research)",
                }),
              ]),
              status: "done",
            }),
          }),
        ]);
      })
  );

  it.effect("deduplicates blank and repeated queries before searching", () =>
    Effect.gen(function* () {
      firecrawlApp.search.mockResolvedValue({
        web: [
          {
            description: "Official docs.",
            markdown: "Official docs content.",
            title: "AI SDK Docs",
            url: "https://ai-sdk.dev/docs",
          },
        ],
      });
      const { parts, writer } = createWriter();
      yield* searchWeb({
        queries: [" AI SDK docs ", "", "ai sdk docs"],
        sourcePreference: "any",
        task: "AI SDK docs",
        toolCallId: "web-search-normalized-queries",
        writer,
      });

      expect(firecrawlApp.search).toHaveBeenCalledTimes(1);
      expect(firecrawlApp.search).toHaveBeenCalledWith(
        "AI SDK docs",
        expect.objectContaining({
          scrapeOptions: expect.objectContaining({
            formats: ["markdown"],
            onlyMainContent: true,
            parsers: [],
          }),
        })
      );
      expect(parts.at(-1)).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            queries: ["AI SDK docs"],
          }),
        })
      );
    })
  );

  it.effect(
    "searches each optimized query with query-scoped visible results",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockImplementation((query: string) =>
          Promise.resolve({
            web: [
              {
                description: `${query} result.`,
                markdown: `${query} content.`,
                title: query,
                url: `https://example.com/${query.toLocaleLowerCase().replaceAll(" ", "-")}`,
              },
            ],
          })
        );
        const { parts, writer } = createWriter();
        const output = yield* searchWeb({
          queries: [
            "AI SDK DevTools official docs",
            "AI SDK DevTools release notes",
          ],
          sourcePreference: "any",
          task: "AI SDK DevTools official docs",
          toolCallId: "web-search-queries",
          writer,
        });

        expect(firecrawlApp.search).toHaveBeenCalledWith(
          "AI SDK DevTools official docs",
          expect.any(Object)
        );
        expect(firecrawlApp.search).toHaveBeenCalledWith(
          "AI SDK DevTools release notes",
          expect.any(Object)
        );
        expect(output.result.sources).toHaveLength(2);
        expect(
          getWebSearchParts(parts).filter((part) => part.status === "done")
        ).toEqual([
          expect.objectContaining({
            queries: ["AI SDK DevTools official docs"],
            sources: expect.arrayContaining([
              expect.objectContaining({
                url: "https://example.com/ai-sdk-devtools-official-docs",
              }),
            ]),
          }),
          expect.objectContaining({
            queries: ["AI SDK DevTools release notes"],
            sources: expect.arrayContaining([
              expect.objectContaining({
                url: "https://example.com/ai-sdk-devtools-release-notes",
              }),
            ]),
          }),
        ]);
      })
  );

  it.effect("keeps successful query results when another query fails", () =>
    Effect.gen(function* () {
      firecrawlApp.search.mockImplementation((query: string) => {
        if (query === "AI SDK DevTools") {
          return Promise.resolve({
            web: [
              {
                description: "Debug AI SDK calls with DevTools.",
                markdown:
                  "AI SDK DevTools captures generations and tool calls.",
                title: "AI SDK DevTools",
                url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
              },
            ],
          });
        }

        return Promise.reject(new Error("timeout"));
      });
      const { parts, writer } = createWriter();
      const output = yield* searchWeb({
        queries: ["AI SDK DevTools", "AI SDK DevTools recent updates"],
        sourcePreference: "any",
        task: "AI SDK DevTools",
        toolCallId: "web-search-partial-success",
        writer,
      });

      expect(output.result.error).toBeUndefined();
      expect(output.result.sources.map((source) => source.url)).toEqual([
        "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
      ]);
      expect(getWebSearchParts(parts)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            queries: ["AI SDK DevTools"],
            status: "done",
            sources: expect.arrayContaining([
              expect.objectContaining({
                url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
              }),
            ]),
          }),
          expect.objectContaining({
            queries: ["AI SDK DevTools recent updates"],
            status: "error",
          }),
        ])
      );
    })
  );

  it.effect(
    "writes an empty done part when Firecrawl returns no result groups",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockResolvedValue({});
        const { parts, writer } = createWriter();
        const output = yield* searchWeb({
          queries: ["latest solar energy research"],
          sourcePreference: "any",
          task: "latest solar energy research",
          toolCallId: "web-search-empty",
          writer,
        });

        expect(output.result.sources).toEqual([]);
        expect(output.text).toContain("# Web Search Results");
        expect(parts.at(-1)).toEqual(
          expect.objectContaining({
            type: "data-web-search",
            data: expect.objectContaining({
              provider: "firecrawl",
              status: "done",
              sources: [],
            }),
          })
        );
      })
  );

  it.effect("writes an error part when Firecrawl search fails", () =>
    Effect.gen(function* () {
      firecrawlApp.search.mockRejectedValue(new Error("offline"));
      const { parts, writer } = createWriter();
      const output = yield* searchWeb({
        queries: ["latest solar energy research"],
        sourcePreference: "any",
        task: "latest solar energy research",
        toolCallId: "web-search-2",
        writer,
      });

      expect(output.result.sources).toEqual([]);
      expect(output.result.error).toContain("Failed to search");
      expect(output.text).toContain("Failed to search");
      expect(parts.at(-1)).toEqual(
        expect.objectContaining({
          type: "data-web-search",
          data: expect.objectContaining({
            provider: "firecrawl",
            status: "error",
          }),
        })
      );
    })
  );
});
