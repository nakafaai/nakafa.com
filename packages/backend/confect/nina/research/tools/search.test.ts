import { beforeEach, describe, expect, it } from "@effect/vitest";
import { searchWeb } from "@repo/backend/confect/nina/research/tools/search";
import { readsPages } from "@repo/backend/test/nina/pages";
import {
  createProgress,
  getWebSearchParts,
} from "@repo/backend/test/nina/progress";
import { Array as Arr, Effect, Logger, MutableRef, Option } from "effect";

const firecrawlApp = vi.hoisted(() => ({
  search: vi.fn(),
}));

vi.mock("@repo/backend/confect/nina/research/provider", () => ({
  readFirecrawlApp: () => Effect.succeed(firecrawlApp),
}));

const readPage = vi.hoisted(() => vi.fn());

vi.mock("@repo/backend/confect/nina/research/tools/scrape", () => ({
  readPage,
}));

vi.mock("@repo/backend/confect/nina/research/domain", async (original) => ({
  ...(await original<
    typeof import("@repo/backend/confect/nina/research/domain")
  >()),
  extractDomain: (url: string) => {
    const hostname = new URL(url).hostname;

    if (hostname.startsWith("www.")) {
      return hostname.slice(4);
    }

    return hostname;
  },
}));

/** What the provider is asked for with every query, besides the query itself. */
const providerOptions = { limit: 5, sources: ["web", "news"], timeout: 10_000 };

/** The sites the model named for the whole call: every query is sent with them. */
const sites = ["kemdikbud.go.id", "bbc.com"];

/**
 * A learner asks about a name written in Latin letters, in their own language.
 * The model writes one query with the name and one in the learner's own words
 * without it. Both run, whatever script the learner writes in.
 */
const askedInOwnLanguage = [
  {
    language: "English",
    request: "What does AI SDK DevTools show about my tool calls?",
    named: "AI SDK DevTools official docs",
    own: "debug tool calls generations",
  },
  {
    language: "Japanese",
    request: "AI SDK DevTools で、ツール呼び出しの何が分かるのか知りたい",
    named: "AI SDK DevTools 公式ドキュメント",
    own: "ツール呼び出し デバッグ 方法",
  },
  {
    language: "Arabic",
    request: "ماذا يعرض AI SDK DevTools عن استدعاءات الأدوات؟",
    named: "AI SDK DevTools الوثائق الرسمية",
    own: "تتبع استدعاءات الأدوات وتصحيحها",
  },
  {
    language: "Thai",
    request: "AI SDK DevTools แสดงอะไรเกี่ยวกับการเรียกใช้เครื่องมือบ้าง",
    named: "AI SDK DevTools เอกสารทางการ",
    own: "ดีบักการเรียกใช้เครื่องมือ",
  },
];

describe("research web search tool", () => {
  beforeEach(() => {
    firecrawlApp.search.mockReset();
    readPage.mockReset();
    readPage.mockImplementation(readsPages({}));
  });

  it.effect(
    "returns every result once, in the provider's order, whatever words it holds, and adds the text of the best pages it could read",
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
              title: "Main Source",
              url: "https://example.com/research",
            },
            {
              description: "Missing URL source.",
              title: "Missing URL Source",
            },
            {
              url: "https://example.com/without-metadata",
            },
            {
              metadata: {
                description: "Document metadata description.",
                ogTitle: "Document Metadata Title",
                sourceURL: "https://docs.example.com/document",
              },
            },
            {
              metadata: {
                sourceURL: "https://docs.example.com/empty",
                title: "Empty Document",
              },
            },
          ],
        });
        readPage.mockImplementation(
          readsPages({ "https://example.com/research": "Main source content." })
        );
        const { parts, publish } = createProgress();
        const output = yield* searchWeb({
          queries: ["Next.js 16 Cache Components"],
          words: "Next.js 16 Cache Components",
          toolCallId: "web-search-1",
          publish,
        });

        expect(output.text).toContain("# Web Search Results");
        expect(Arr.map(output.result.sources, (source) => source.url)).toEqual([
          "https://example.com/research",
          "https://example.com/without-metadata",
          "https://docs.example.com/document",
          "https://docs.example.com/empty",
          "https://news.example.com/update",
          "https://news.example.com/without-title",
        ]);
        expect(output.result.sources).toContainEqual(
          expect.objectContaining({
            content: "",
            description: "Document metadata description.",
            title: "Document Metadata Title",
            url: "https://docs.example.com/document",
          })
        );
        expect(Arr.map(readPage.mock.calls, ([url]) => url)).toEqual([
          "https://example.com/research",
          "https://example.com/without-metadata",
        ]);
        expect(readPage).toHaveBeenLastCalledWith(
          "https://example.com/without-metadata",
          { deadlineMs: 10_000, timeoutMs: 8000 }
        );
        expect(output.result.sources).toContainEqual(
          expect.objectContaining({
            content: "",
            url: "https://example.com/without-metadata",
          })
        );
        expect(output.text).toContain(
          "- Inline citation: [example.com](https://example.com/research)"
        );
        expect(output.text).toContain("### Content\nMain source content.");
        expect(output.text).toContain(
          "- Page text: not read. Only the description above is known."
        );
        expect(parts()).toEqual([
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

  it.effect("chooses page paragraphs by the words, not the queries", () =>
    Effect.gen(function* () {
      const url = "https://example.com/krebs";
      const forWords = "Siklus Krebs berlangsung di matriks. ".repeat(18);
      const forQueries = "The citric acid cycle makes ATP. ".repeat(20);
      const page = Arr.join(
        ["Cuaca cerah hari ini. ".repeat(40), forWords, forQueries],
        "\n\n"
      );
      firecrawlApp.search.mockResolvedValue({ web: [{ url }] });
      readPage.mockImplementation(readsPages({ [url]: page }));
      const output = yield* searchWeb({
        queries: ["citric acid cycle"],
        words: "Jelaskan siklus Krebs",
        toolCallId: "web-search-words",
        publish: createProgress().publish,
      });

      expect(output.result.sources).toEqual([
        expect.objectContaining({ content: forWords.trim() }),
      ]);
    })
  );

  it.effect(
    "shows an address once, however many results or queries repeat it",
    () =>
      Effect.gen(function* () {
        const result = (name: string) => ({
          description: `Kurikulum ${name}.`,
          title: `Kurikulum ${name}`,
          url: `https://example.com/${name}`,
        });
        firecrawlApp.search
          .mockResolvedValueOnce({
            web: [result("a"), result("a"), result("b")],
          })
          .mockResolvedValueOnce({ web: [result("a"), result("c")] });
        const { parts, publish } = createProgress();
        const output = yield* searchWeb({
          queries: ["kurikulum merdeka", "kurikulum sma"],
          words: "kurikulum",
          toolCallId: "web-search-repeats",
          publish,
        });

        // The first query repeats the address a, and the second finds it again.
        expect(Arr.map(output.result.sources, (source) => source.url)).toEqual([
          "https://example.com/a",
          "https://example.com/b",
          "https://example.com/c",
        ]);
        expect(
          Arr.map(
            Arr.filter(
              getWebSearchParts(parts()),
              ({ status }) => status === "done"
            ),
            ({ sources }) => Arr.map(sources, (source) => source.url)
          )
        ).toEqual([
          ["https://example.com/a", "https://example.com/b"],
          ["https://example.com/a", "https://example.com/c"],
        ]);
        // The two pages it reads are two different addresses.
        expect(Arr.map(readPage.mock.calls, ([url]) => url)).toEqual([
          "https://example.com/a",
          "https://example.com/b",
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
      const { parts, publish } = createProgress();
      yield* searchWeb({
        queries: [" AI SDK docs ", "", "ai sdk docs"],
        words: "AI SDK docs",
        toolCallId: "web-search-normalized-queries",
        publish,
      });

      expect(firecrawlApp.search).toHaveBeenCalledTimes(1);
      expect(firecrawlApp.search).toHaveBeenCalledWith(
        "AI SDK docs",
        expect.objectContaining({ limit: 5 })
      );
      expect(Option.getOrThrow(Arr.last(parts()))).toEqual(
        expect.objectContaining({
          data: expect.objectContaining({
            queries: ["AI SDK docs"],
          }),
        })
      );
      // An open search names no site, so no card carries the field.
      expect(
        Arr.some(getWebSearchParts(parts()), (part) => "sites" in part)
      ).toBe(false);
    })
  );

  it.effect.each(askedInOwnLanguage)(
    "sends the provider every query the model wrote as written, also one that holds none of the request's names, each with the sites of the call, and shows each query its own results ($language)",
    ({ named, own, request }) =>
      Effect.gen(function* () {
        const urlOf = (query: string) =>
          query === named
            ? "https://example.com/named"
            : "https://example.com/own";
        firecrawlApp.search.mockImplementation((query: string) =>
          Promise.resolve({
            web: [
              {
                description: `${query} result.`,
                title: query,
                url: urlOf(query),
              },
            ],
          })
        );
        const { parts, publish } = createProgress();
        const output = yield* searchWeb({
          queries: [named, own],
          sites,
          words: request,
          toolCallId: "web-search-queries",
          publish,
        });

        expect(firecrawlApp.search.mock.calls).toEqual([
          [named, { ...providerOptions, includeDomains: sites }],
          [own, { ...providerOptions, includeDomains: sites }],
        ]);
        expect(Arr.map(output.result.sources, (source) => source.url)).toEqual([
          "https://example.com/named",
          "https://example.com/own",
        ]);
        expect(
          Arr.map(
            Arr.filter(
              getWebSearchParts(parts()),
              ({ status }) => status === "done"
            ),
            ({ queries, sources }) => [
              queries,
              Arr.map(sources, (source) => source.url),
            ]
          )
        ).toEqual([
          [[named], ["https://example.com/named"]],
          [[own], ["https://example.com/own"]],
        ]);
        // Every card of the call, loading or done, says the sites it was limited to.
        expect(
          Arr.map(getWebSearchParts(parts()), (part) => part.sites)
        ).toEqual(Arr.makeBy(4, () => sites));
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
      const { parts, publish } = createProgress();
      const output = yield* searchWeb({
        queries: ["AI SDK DevTools", "AI SDK DevTools recent updates"],
        words: "AI SDK DevTools",
        toolCallId: "web-search-partial-success",
        publish,
      });

      expect(output.result.error).toBeUndefined();
      expect(Arr.map(output.result.sources, (source) => source.url)).toEqual([
        "https://ai-sdk.dev/docs/ai-sdk-core/devtools",
      ]);
      expect(getWebSearchParts(parts())).toEqual(
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
        const { parts, publish } = createProgress();
        const output = yield* searchWeb({
          queries: ["latest solar energy research"],
          words: "latest solar energy research",
          toolCallId: "web-search-empty",
          publish,
        });

        expect(output.result.sources).toEqual([]);
        expect(output.text).toContain("# Web Search Results");
        expect(Option.getOrThrow(Arr.last(parts()))).toEqual(
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

  it.effect(
    "writes an error part when Firecrawl search fails, and logs its status without its message",
    () =>
      Effect.gen(function* () {
        firecrawlApp.search.mockRejectedValue(
          Object.assign(new Error("Unauthorized: solar energy research"), {
            status: 401,
          })
        );
        const logged = MutableRef.make<readonly unknown[]>([]);
        const { parts, publish } = createProgress();
        const output = yield* searchWeb({
          queries: ["latest solar energy research"],
          words: "latest solar energy research",
          toolCallId: "web-search-2",
          publish,
        }).pipe(
          Effect.provide(
            Logger.layer([
              Logger.formatStructured.pipe(
                Logger.map(({ message }) =>
                  MutableRef.update(logged, Arr.append(message))
                )
              ),
            ])
          )
        );

        expect(MutableRef.get(logged)).toEqual([
          ["Nina web search failed", { status: 401 }],
        ]);

        expect(output.result.sources).toEqual([]);
        expect(output.result.error).toContain("Failed to search");
        expect(output.text).toContain("Failed to search");
        expect(Option.getOrThrow(Arr.last(parts()))).toEqual(
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
