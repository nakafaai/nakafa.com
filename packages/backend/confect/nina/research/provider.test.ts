import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  requestScrape,
  requestSearch,
} from "@repo/backend/confect/nina/research/provider";
import {
  inBackground,
  overKey,
  overProvider,
  providerKey,
  providerScrapeUrl,
  providerSearchUrl,
  refusal,
  scrapeAnswer,
  searchAnswer,
  sentBodies,
} from "@repo/backend/test/nina/provider";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Duration,
  Effect,
  Fiber,
  MutableRef,
  Tracer,
} from "effect";
import { TestClock } from "effect/testing";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();
const overFetch = overProvider(fetcher);

const search = {
  deadline: Duration.seconds(12),
  limit: 5,
  query: "kurikulum merdeka",
  sites: [],
  timeoutMs: 10_000,
};
const page = {
  deadline: Duration.seconds(30),
  timeoutMs: 15_000,
  url: "https://example.com/docs/page",
};

/** The headers of every request: no trace header among them. */
const headers = {
  accept: "application/json",
  authorization: `Bearer ${providerKey}`,
  "content-type": "application/json",
};

/** A bad gateway, as it reaches the provider's callers. */
const badGateway = () =>
  Promise.resolve(new Response("Bad gateway", { status: 502 }));

/** A request that the provider never answers. */
const never = () => new Promise<Response>(() => undefined);

beforeEach(() => {
  fetcher.mockReset();
});

describe("the research provider requests", () => {
  it.effect(
    "sends a search as JSON with the key to the search endpoint, for the web and the news",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(searchAnswer({ web: [] }));
        yield* requestSearch(search).pipe(overFetch);

        expect(fetcher).toHaveBeenCalledOnce();
        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(url).toEqual(providerSearchUrl);
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual(headers);
        expect(yield* sentBodies(fetcher)).toEqual([
          {
            query: "kurikulum merdeka",
            sources: ["web", "news"],
            limit: 5,
            timeout: 10_000,
          },
        ]);
      })
  );

  it.effect("names the sites of a search exactly as given", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(searchAnswer({ web: [] }));
      yield* requestSearch({
        ...search,
        sites: ["snpmb.bppp.kemdikbud.go.id", "bbc.com"],
      }).pipe(overFetch);

      expect(yield* sentBodies(fetcher)).toMatchObject([
        { includeDomains: ["snpmb.bppp.kemdikbud.go.id", "bbc.com"] },
      ]);
    })
  );

  it.effect("leaves the includeDomains field out for an empty list", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(searchAnswer({ web: [] }));
      yield* requestSearch(search).pipe(overFetch);

      const [body] = yield* sentBodies(fetcher);
      expect(body).not.toHaveProperty("includeDomains");
    })
  );

  it.effect(
    "sends a page read for the markdown format with the limit it is given, and never asks the provider to resume it",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(scrapeAnswer({ markdown: "# Page" }));
        yield* requestScrape(page).pipe(overFetch);

        const [url, init] = fetcher.mock.calls[0] ?? [];
        expect(url).toEqual(providerScrapeUrl);
        expect(init?.method).toBe("POST");
        expect(init?.headers).toEqual(headers);
        expect(yield* sentBodies(fetcher)).toEqual([
          {
            url: "https://example.com/docs/page",
            formats: ["markdown"],
            timeout: 15_000,
          },
        ]);
      })
  );

  it.effect(
    "reads the parts of a search answer that Nina uses: a text is a string, a list of strings or null, and nothing else is kept",
    () =>
      Effect.gen(function* () {
        fetcher.mockResolvedValue(
          searchAnswer({
            news: [
              {
                date: "2026-10-12",
                snippet: "News snippet.",
                url: "https://news.example.com/a",
              },
            ],
            web: [
              {
                description: null,
                markdown: "Not asked for, so never kept.",
                metadata: {
                  description: ["First", "Second"],
                  favicon: null,
                  statusCode: 200,
                },
                title: ["Repeated", "Title"],
                url: "https://docs.example.com/a",
              },
              { url: "https://docs.example.com/b" },
            ],
          })
        );

        expect(yield* requestSearch(search).pipe(overFetch)).toEqual({
          news: [
            { snippet: "News snippet.", url: "https://news.example.com/a" },
          ],
          web: [
            {
              description: null,
              metadata: { description: ["First", "Second"], favicon: null },
              title: ["Repeated", "Title"],
              url: "https://docs.example.com/a",
            },
            { url: "https://docs.example.com/b" },
          ],
        });
      })
  );

  it.effect("reads the markdown and the metadata of a page", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(
        scrapeAnswer({
          markdown: "# Page",
          metadata: { statusCode: 200, title: ["A", "B"] },
          warning: null,
        })
      );

      expect(yield* requestScrape(page).pipe(overFetch)).toEqual({
        markdown: "# Page",
        metadata: { title: ["A", "B"] },
      });
    })
  );
});

describe("a research provider request that fails", () => {
  it.effect(
    "keeps the status of the answer and never its message, which may repeat the query or the address",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(() =>
          Promise.resolve(
            refusal(
              401,
              "Refused kurikulum merdeka at https://example.com/docs"
            )
          )
        );

        const searched = yield* Effect.flip(
          requestSearch(search).pipe(overFetch)
        );
        const read = yield* Effect.flip(requestScrape(page).pipe(overFetch));

        expect(searched).toMatchObject({
          _tag: "ResearchSearchError",
          message: "Failed to search the web. Please try again.",
          status: 401,
        });
        expect(read).toMatchObject({
          _tag: "ResearchScrapeError",
          message: "The page could not be retrieved. Please try again.",
        });
        for (const error of [searched, read]) {
          expect(String(error)).not.toContain("Refused");
          expect(encodeJsonText(error)).not.toContain("Refused");
          expect(encodeJsonText(error)).not.toContain(providerKey);
        }
      })
  );

  it.effect(
    "aborts the request of a refused answer, which it never reads",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(() =>
          Promise.resolve(refusal(401, "Refused"))
        );

        yield* Effect.flip(requestScrape(page).pipe(overFetch));

        expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      })
  );

  it.effect("sends nothing below the least time the provider takes", () =>
    Effect.gen(function* () {
      const searched = yield* Effect.flip(
        requestSearch({ ...search, timeoutMs: 0 }).pipe(overFetch)
      );
      const read = yield* Effect.flip(
        requestScrape({ ...page, timeoutMs: 999 }).pipe(overFetch)
      );
      expect(searched._tag).toBe("ResearchSearchError");
      expect(read._tag).toBe("ResearchScrapeError");
      expect(fetcher).not.toHaveBeenCalled();

      // The least is 1 millisecond for a search and 1 second for a page read.
      fetcher
        .mockResolvedValueOnce(searchAnswer({ web: [] }))
        .mockResolvedValueOnce(scrapeAnswer({ markdown: "# Page" }));
      yield* requestSearch({ ...search, timeoutMs: 1 }).pipe(overFetch);
      yield* requestScrape({ ...page, timeoutMs: 1000 }).pipe(overFetch);
      expect(yield* sentBodies(fetcher)).toMatchObject([
        { timeout: 1 },
        { timeout: 1000 },
      ]);
    })
  );

  it.effect("has no status when no answer came", () =>
    Effect.gen(function* () {
      fetcher.mockRejectedValue(new Error("socket hang up"));

      const error = yield* Effect.flip(requestSearch(search).pipe(overFetch));

      expect(error.message).toBe("Failed to search the web. Please try again.");
      expect(error.status).toBeUndefined();
    })
  );

  it.effect.each([
    {
      answer: () =>
        Promise.resolve(
          Response.json({ data: { web: [] }, error: "Failed", success: false })
        ),
      text: "an answer that says it failed",
    },
    {
      answer: () => Promise.resolve(new Response("<html>Oops</html>")),
      text: "an answer that is not JSON",
    },
    {
      answer: () => Promise.resolve(Response.json({ success: true })),
      text: "an answer without its data",
    },
  ])("keeps the status of $text, which is not a usable answer", ({ answer }) =>
    Effect.gen(function* () {
      fetcher.mockImplementation(answer);

      const error = yield* Effect.flip(requestSearch(search).pipe(overFetch));

      expect(error.status).toBe(200);
    })
  );

  it.effect(
    "asks again after a bad gateway, after half a second and then after one second, and gives up after the third answer",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(badGateway);
        const fiber = yield* inBackground(
          Effect.flip(requestSearch(search).pipe(overFetch))
        );
        expect(fetcher).toHaveBeenCalledTimes(1);

        yield* TestClock.adjust("499 millis");
        expect(fetcher).toHaveBeenCalledTimes(1);
        yield* TestClock.adjust("1 millis");
        expect(fetcher).toHaveBeenCalledTimes(2);

        yield* TestClock.adjust("999 millis");
        expect(fetcher).toHaveBeenCalledTimes(2);
        yield* TestClock.adjust("1 millis");

        const error = yield* Fiber.join(fiber);
        expect(fetcher).toHaveBeenCalledTimes(3);
        expect(error.status).toBe(502);
      })
  );

  it.effect("reads the answer that follows a bad gateway", () =>
    Effect.gen(function* () {
      fetcher
        .mockImplementationOnce(badGateway)
        .mockResolvedValueOnce(scrapeAnswer({ markdown: "# Page" }));
      const fiber = yield* inBackground(requestScrape(page).pipe(overFetch));

      yield* TestClock.adjust("500 millis");

      expect(yield* Fiber.join(fiber)).toEqual({ markdown: "# Page" });
      expect(fetcher).toHaveBeenCalledTimes(2);
    })
  );

  it.effect.each([401, 408, 429, 500, 503])(
    "asks only once when the provider answers %s",
    (status) =>
      Effect.gen(function* () {
        fetcher.mockImplementation(() =>
          Promise.resolve(new Response("", { status }))
        );
        const fiber = yield* inBackground(
          Effect.flip(requestScrape(page).pipe(overFetch))
        );

        yield* TestClock.adjust("1 minute");

        expect((yield* Fiber.join(fiber))._tag).toBe("ResearchScrapeError");
        expect(fetcher).toHaveBeenCalledOnce();
      })
  );

  it.effect(
    "ends at its deadline when the provider never answers, and aborts the request",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(never);
        const fiber = yield* inBackground(
          Effect.flip(
            requestSearch({ ...search, deadline: Duration.seconds(3) }).pipe(
              overFetch
            )
          )
        );

        yield* TestClock.adjust("2999 millis");
        expect(fiber.pollUnsafe()).toBeUndefined();
        yield* TestClock.adjust("1 millis");

        const error = yield* Fiber.join(fiber);
        expect(error.message).toBe(
          "Failed to search the web. Please try again."
        );
        expect(error.status).toBeUndefined();
        expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
      })
  );

  it.effect("counts the bad gateway retries in the deadline", () =>
    Effect.gen(function* () {
      fetcher.mockImplementationOnce(badGateway).mockImplementationOnce(never);
      const fiber = yield* inBackground(
        Effect.flip(
          requestScrape({ ...page, deadline: Duration.seconds(2) }).pipe(
            overFetch
          )
        )
      );

      yield* TestClock.adjust("1999 millis");
      expect(fiber.pollUnsafe()).toBeUndefined();
      yield* TestClock.adjust("1 millis");

      expect((yield* Fiber.join(fiber))._tag).toBe("ResearchScrapeError");
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(fetcher.mock.calls[1]?.[1]?.signal?.aborted).toBe(true);
    })
  );
});

describe("the research provider key", () => {
  it.effect.each([
    { key: undefined, text: "missing" },
    { key: "", text: "empty" },
    { key: "   \n", text: "blank" },
  ])("is $text: nothing is sent and the learner is told", ({ key }) =>
    Effect.gen(function* () {
      const searched = yield* Effect.flip(
        requestSearch(search).pipe(overKey(fetcher, key))
      );
      const read = yield* Effect.flip(
        requestScrape(page).pipe(overKey(fetcher, key))
      );

      expect(searched).toMatchObject({
        _tag: "ResearchSearchError",
        message: "Web research is not configured.",
      });
      expect(searched.status).toBeUndefined();
      expect(read).toMatchObject({
        _tag: "ResearchScrapeError",
        message: "Web research is not configured.",
      });
      expect(fetcher).not.toHaveBeenCalled();
    })
  );

  it.effect("is sent without the spaces around it", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(searchAnswer({}));

      yield* requestSearch(search).pipe(overKey(fetcher, `  ${providerKey}\n`));

      expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual(headers);
    })
  );
});

describe("the research provider spans", () => {
  it.effect(
    "carry neither the query, nor a site, nor the address of a page",
    () =>
      Effect.gen(function* () {
        const spans = MutableRef.make<readonly Tracer.NativeSpan[]>([]);
        const recorder = Tracer.make({
          span(options) {
            const span = new Tracer.NativeSpan(options);
            MutableRef.update(spans, Arr.append(span));
            return span;
          },
        });
        fetcher.mockImplementation(() =>
          Promise.resolve(searchAnswer({ web: [] }))
        );
        yield* requestSearch({
          ...search,
          query: "kurikulum rahasia",
          sites: ["rahasia.example.org"],
        }).pipe(overFetch, Effect.provideService(Tracer.Tracer, recorder));
        fetcher.mockImplementation(() =>
          Promise.resolve(scrapeAnswer({ markdown: "# Page" }))
        );
        yield* requestScrape({
          ...page,
          url: "https://halaman.example.net/jalan-rahasia",
        }).pipe(overFetch, Effect.provideService(Tracer.Tracer, recorder));

        const attributes = Arr.flatMap(MutableRef.get(spans), (span) =>
          Arr.fromIterable(span.attributes.entries())
        );
        const text = Arr.join(
          Arr.map(attributes, ([key, value]) => `${key}=${String(value)}`),
          "\n"
        );
        // The requests did run under the recorder, so an empty text proves nothing.
        expect(text).toContain("http.request.method=POST");
        expect(text).not.toContain("kurikulum");
        expect(text).not.toContain("rahasia");
        expect(text).not.toContain("halaman.example.net");
      })
  );
});
