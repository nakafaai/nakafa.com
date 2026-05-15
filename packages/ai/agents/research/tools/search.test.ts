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
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["latest solar energy research"],
        toolCallId: "web-search-1",
        writer,
      })
    );

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

  it("keeps sources scoped to distinctive query terms when adjacent tools appear", async () => {
    firecrawlApp.search.mockResolvedValue({
      web: [
        {
          description: "AI SDK DevTools documentation.",
          markdown: "Inspect AI SDK DevTools generations and tool calls.",
          title: "AI SDK DevTools",
          url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        },
        {
          description: "AI assistance in browser developer tools.",
          markdown: "Chrome DevTools can explain console errors with AI.",
          title: "Chrome DevTools AI Assistance",
          url: "https://developer.chrome.com/docs/devtools/ai-assistance",
        },
      ],
    });
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["AI SDK DevTools latest"],
        toolCallId: "web-search-scoped",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
    ]);
  });

  it("keeps natural multilingual source queries scoped to the named product", async () => {
    firecrawlApp.search.mockResolvedValue({
      web: [
        {
          description:
            "AI SDK DevTools gives you full visibility over your AI SDK calls.",
          markdown: "Debug AI SDK DevTools generations and tool calls.",
          title: "AI SDK Core: DevTools",
          url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
        },
        {
          description: "Panel bantuan AI langsung di DevTools.",
          markdown: "Chrome DevTools can explain console errors with AI.",
          title: "Mengaktifkan bantuan AI di DevTools",
          url: "https://developer.chrome.com/docs/devtools/ai-assistance?hl=id",
        },
      ],
    });
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["AI SDK DevTools official documentation terbaru"],
        toolCallId: "web-search-natural-scoped",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
    ]);
  });

  it("scopes a single mixed-case query term when the first source matches it", async () => {
    firecrawlApp.search.mockResolvedValue({
      web: [
        {
          description: "DevTools debugging reference.",
          markdown: "Use DevTools to inspect generated calls.",
          title: "DevTools Reference",
          url: "https://example.com/devtools",
        },
        {
          description: "Developer tooling without the requested source name.",
          markdown: "General browser debugging notes.",
          title: "Developer Tools",
          url: "https://example.com/general-tools",
        },
      ],
    });
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["devTools"],
        toolCallId: "web-search-single-mixed-case",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://example.com/devtools",
    ]);
  });

  it("keeps all sources when distinctive query terms do not match the first source", async () => {
    firecrawlApp.search.mockResolvedValue({
      web: [
        {
          description: "AI platform documentation.",
          markdown: "AI platform content.",
          title: "AI Platform",
          url: "https://example.com/ai-platform",
        },
        {
          description: "AI SDK documentation.",
          markdown: "AI SDK content.",
          title: "AI SDK",
          url: "https://example.com/ai-sdk",
        },
      ],
    });
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["AI SDK"],
        toolCallId: "web-search-first-source-mismatch",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://example.com/ai-platform",
      "https://example.com/ai-sdk",
    ]);
  });

  it("scopes lowercase hyphenated source queries when the first source matches", async () => {
    firecrawlApp.search.mockResolvedValue({
      web: [
        {
          description: "ai-sdk package reference.",
          markdown: "Install ai-sdk from the package registry.",
          title: "ai-sdk",
          url: "https://example.com/ai-sdk",
        },
        {
          description: "AI package examples.",
          markdown: "Generic package examples.",
          title: "AI Packages",
          url: "https://example.com/packages",
        },
      ],
    });
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["ai-sdk"],
        toolCallId: "web-search-hyphenated",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://example.com/ai-sdk",
    ]);
  });

  it("deduplicates repeated distinctive query terms before source scoping", async () => {
    firecrawlApp.search.mockResolvedValue({
      web: [
        {
          description: "AI reference.",
          markdown: "AI content.",
          title: "AI Reference",
          url: "https://example.com/ai",
        },
      ],
    });
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["AI AI"],
        toolCallId: "web-search-duplicate-terms",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://example.com/ai",
    ]);
  });

  it("does not scope short single acronyms that are too broad for filtering", async () => {
    firecrawlApp.search.mockResolvedValue({
      web: [
        {
          description: "AI overview.",
          markdown: "AI background.",
          title: "AI Overview",
          url: "https://example.com/ai",
        },
        {
          description: "AI platform update.",
          markdown: "AI platform content.",
          title: "Platform Update",
          url: "https://example.com/platform",
        },
      ],
    });
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["AI"],
        toolCallId: "web-search-short-acronym",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://example.com/ai",
      "https://example.com/platform",
    ]);
  });

  it("deduplicates blank and repeated queries before searching", async () => {
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
    await Effect.runPromise(
      searchWeb({
        queries: [" AI SDK docs ", "", "ai sdk docs"],
        toolCallId: "web-search-normalized-queries",
        writer,
      })
    );

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
  });

  it("searches each optimized query while preserving the visible query list", async () => {
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
    const output = await Effect.runPromise(
      searchWeb({
        queries: [
          "AI SDK DevTools official docs",
          "AI SDK DevTools release notes",
        ],
        toolCallId: "web-search-queries",
        writer,
      })
    );

    expect(firecrawlApp.search).toHaveBeenCalledWith(
      "AI SDK DevTools official docs",
      expect.any(Object)
    );
    expect(firecrawlApp.search).toHaveBeenCalledWith(
      "AI SDK DevTools release notes",
      expect.any(Object)
    );
    expect(output.result.sources).toHaveLength(2);
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          queries: [
            "AI SDK DevTools official docs",
            "AI SDK DevTools release notes",
          ],
        }),
      })
    );
  });

  it("keeps distinctive intent terms when optimized queries drift generic", async () => {
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
    await Effect.runPromise(
      searchWeb({
        queries: [
          "AI SDK development trends 2026",
          "future of AI software development tools 2026",
        ],
        intent:
          "latest information about AI SDK DevTools trends and features 2026",
        toolCallId: "web-search-intent-terms",
        writer,
      })
    );

    expect(firecrawlApp.search).toHaveBeenCalledWith(
      "AI SDK DevTools",
      expect.any(Object)
    );
    expect(firecrawlApp.search).toHaveBeenCalledWith(
      "DevTools AI SDK development trends 2026",
      expect.any(Object)
    );
    expect(firecrawlApp.search).toHaveBeenCalledWith(
      "SDK DevTools future of AI software development tools 2026",
      expect.any(Object)
    );
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          queries: [
            "AI SDK DevTools",
            "DevTools AI SDK development trends 2026",
            "SDK DevTools future of AI software development tools 2026",
          ],
        }),
      })
    );
  });

  it("scopes every query result to distinctive intent terms", async () => {
    firecrawlApp.search.mockImplementation((query: string) => {
      if (query === "AI SDK DevTools") {
        return Promise.resolve({
          web: [
            {
              description: "Debug AI SDK calls with DevTools.",
              markdown: "AI SDK DevTools captures generations and tool calls.",
              title: "AI SDK DevTools",
              url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
            },
            {
              description: "Browser DevTools AI assistance.",
              markdown: "Chrome can explain console errors.",
              title: "Chrome DevTools AI Assistance",
              url: "https://developer.chrome.com/docs/devtools/ai-assistance",
            },
          ],
        });
      }

      return Promise.resolve({
        web: [
          {
            description: "LangChain SDK updates.",
            markdown: "LangChain developer tooling updates.",
            title: "LangChain SDK DevTools",
            url: "https://changelog.langchain.com/devtools",
          },
        ],
      });
    });
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["SDK DevTools recent major updates LangChain framework"],
        intent: "AI SDK DevTools",
        toolCallId: "web-search-intent-scoped-sources",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
    ]);
  });

  it("keeps successful query results when another query fails", async () => {
    firecrawlApp.search.mockImplementation((query: string) => {
      if (query === "AI SDK DevTools") {
        return Promise.resolve({
          web: [
            {
              description: "Debug AI SDK calls with DevTools.",
              markdown: "AI SDK DevTools captures generations and tool calls.",
              title: "AI SDK DevTools",
              url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
            },
          ],
        });
      }

      return Promise.reject(new Error("timeout"));
    });
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["AI SDK DevTools recent updates"],
        intent: "AI SDK DevTools",
        toolCallId: "web-search-partial-success",
        writer,
      })
    );

    expect(output.result.error).toBeUndefined();
    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
    ]);
    expect(parts.at(-1)).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "done",
        }),
      })
    );
  });

  it("writes an empty done part when Firecrawl returns no result groups", async () => {
    firecrawlApp.search.mockResolvedValue({});
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["latest solar energy research"],
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
        queries: ["latest solar energy research"],
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
