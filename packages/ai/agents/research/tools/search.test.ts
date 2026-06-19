import { searchWeb } from "@repo/ai/agents/research/tools/search";
import type { MyUIMessage } from "@repo/ai/types/message";
import type { UIMessageStreamWriter } from "ai";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
        sourcePreference: "any",
        task: "latest solar energy research",
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
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["AI SDK DevTools latest"],
        sourcePreference: "any",
        task: "AI SDK DevTools latest",
        toolCallId: "web-search-scoped",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
    ]);
    expect(getWebSearchParts(parts).at(-1)).toEqual(
      expect.objectContaining({
        provider: "firecrawl",
        sources: [
          expect.objectContaining({
            url: "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
          }),
        ],
      })
    );
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
        sourcePreference: "any",
        task: "AI SDK DevTools official documentation terbaru",
        toolCallId: "web-search-natural-scoped",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
    ]);
  });

  it("keeps primary-source requests on first-party product domains", async () => {
    firecrawlApp.search.mockResolvedValue({
      web: [
        {
          description: "Official React docs for transitions.",
          markdown: "React 19 transition behavior.",
          title: "React useTransition",
          url: "https://react.dev/reference/react/useTransition",
        },
        {
          description: "Community explanation for React 19.",
          markdown: "React 19 transition behavior.",
          title: "React 19 Guide",
          url: "https://example.com/react-19-transitions",
        },
      ],
    });
    const { writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["React 19 transition docs"],
        sourcePreference: "primary",
        task: "React 19 transitions",
        toolCallId: "web-search-primary-source",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://react.dev/reference/react/useTransition",
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
        sourcePreference: "any",
        task: "devTools",
        toolCallId: "web-search-single-mixed-case",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
      "https://example.com/devtools",
    ]);
  });

  it("scopes sources to explicit task terms even when generic results rank first", async () => {
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
        sourcePreference: "any",
        task: "AI SDK",
        toolCallId: "web-search-first-source-mismatch",
        writer,
      })
    );

    expect(output.result.sources.map((source) => source.url)).toEqual([
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
        sourcePreference: "any",
        task: "ai-sdk",
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
        sourcePreference: "any",
        task: "AI AI",
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
        sourcePreference: "any",
        task: "AI",
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
        sourcePreference: "any",
        task: "AI SDK docs",
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

  it("does not clip school-event research queries from the user task", async () => {
    firecrawlApp.search.mockResolvedValue({});
    const { parts, writer } = createWriter();
    await Effect.runPromise(
      searchWeb({
        queries: [
          '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
          '"SMA Tirta Lazuardi" kegiatan 2026',
          "apakah SMA Tirta Lazuardi ada tryout matematika nasional 28 Mei 2026",
        ],
        sourcePreference: "primary",
        task: [
          "# User Request",
          "Aku dengar SMA Tirta Lazuardi akan adakan tryout matematika nasional pada 28 Mei 2026. Ini benar atau cuma kabar?",
        ].join("\n\n"),
        toolCallId: "web-search-school-event",
        writer,
      })
    );

    expect(firecrawlApp.search).not.toHaveBeenCalledWith(
      "SMA Tirta Lazuardi akan",
      expect.any(Object)
    );
    expect(firecrawlApp.search).toHaveBeenCalledWith(
      '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
      expect.any(Object)
    );
    expect(firecrawlApp.search).toHaveBeenCalledWith(
      '"SMA Tirta Lazuardi" kegiatan 2026',
      expect.any(Object)
    );
    expect(firecrawlApp.search).toHaveBeenCalledWith(
      "apakah SMA Tirta Lazuardi ada tryout matematika nasional 28 Mei 2026",
      expect.any(Object)
    );
    expect(
      getWebSearchParts(parts).filter((part) => part.status === "done")
    ).toEqual([
      expect.objectContaining({
        queries: [
          '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
        ],
      }),
      expect.objectContaining({
        queries: ['"SMA Tirta Lazuardi" kegiatan 2026'],
      }),
      expect.objectContaining({
        queries: [
          "apakah SMA Tirta Lazuardi ada tryout matematika nasional 28 Mei 2026",
        ],
      }),
    ]);
  });

  it("does not execute broad school-event query variants without the named school", async () => {
    firecrawlApp.search.mockResolvedValue({});
    const { parts, writer } = createWriter();
    await Effect.runPromise(
      searchWeb({
        queries: [
          '"SMA Tirta Lazuardi"',
          '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
          '"tryout matematika nasional" 28 Mei 2026',
        ],
        sourcePreference: "primary",
        task: [
          "# User Request",
          "Aku dengar SMA Tirta Lazuardi akan adakan tryout matematika nasional pada 28 Mei 2026. Ini benar atau cuma kabar?",
        ].join("\n\n"),
        toolCallId: "web-search-school-event-scope",
        writer,
      })
    );

    expect(firecrawlApp.search).toHaveBeenCalledWith(
      '"SMA Tirta Lazuardi"',
      expect.any(Object)
    );
    expect(firecrawlApp.search).toHaveBeenCalledWith(
      '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
      expect.any(Object)
    );
    expect(firecrawlApp.search).not.toHaveBeenCalledWith(
      '"tryout matematika nasional" 28 Mei 2026',
      expect.any(Object)
    );
    expect(
      getWebSearchParts(parts).filter((part) => part.status === "done")
    ).toEqual([
      expect.objectContaining({
        queries: ['"SMA Tirta Lazuardi"'],
      }),
      expect.objectContaining({
        queries: [
          '"SMA Tirta Lazuardi" tryout matematika nasional 28 Mei 2026',
        ],
      }),
    ]);
  });

  it("searches each optimized query with query-scoped visible results", async () => {
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
        sourcePreference: "any",
        task: "AI SDK DevTools official docs",
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
  });

  it("keeps distinctive task terms when optimized queries drift generic", async () => {
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
        sourcePreference: "any",
        task: "latest information about AI SDK DevTools trends and features 2026",
        toolCallId: "web-search-task-terms",
        writer,
      })
    );

    expect(firecrawlApp.search).toHaveBeenCalledWith(
      "AI SDK development trends 2026",
      expect.any(Object)
    );
    expect(firecrawlApp.search).toHaveBeenCalledWith(
      "future of AI software development tools 2026",
      expect.any(Object)
    );
    expect(
      getWebSearchParts(parts).filter((part) => part.status === "done")
    ).toEqual([
      expect.objectContaining({
        queries: ["AI SDK development trends 2026"],
      }),
      expect.objectContaining({
        queries: ["future of AI software development tools 2026"],
      }),
    ]);
  });

  it("does not inject hidden task-anchor searches when a query is provided", async () => {
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
        sourcePreference: "any",
        task: "AI SDK DevTools",
        toolCallId: "web-search-task-scoped-sources",
        writer,
      })
    );

    expect(firecrawlApp.search).not.toHaveBeenCalledWith(
      "AI SDK DevTools",
      expect.any(Object)
    );
    expect(output.result.sources.map((source) => source.url)).toEqual([]);
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
        queries: ["AI SDK DevTools", "AI SDK DevTools recent updates"],
        sourcePreference: "any",
        task: "AI SDK DevTools",
        toolCallId: "web-search-partial-success",
        writer,
      })
    );

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
  });

  it("writes an empty done part when Firecrawl returns no result groups", async () => {
    firecrawlApp.search.mockResolvedValue({});
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["latest solar energy research"],
        sourcePreference: "any",
        task: "latest solar energy research",
        toolCallId: "web-search-empty",
        writer,
      })
    );

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
  });

  it("writes an error part when Firecrawl search fails", async () => {
    firecrawlApp.search.mockRejectedValue(new Error("offline"));
    const { parts, writer } = createWriter();
    const output = await Effect.runPromise(
      searchWeb({
        queries: ["latest solar energy research"],
        sourcePreference: "any",
        task: "latest solar energy research",
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
        data: expect.objectContaining({
          provider: "firecrawl",
          status: "error",
        }),
      })
    );
  });
});
