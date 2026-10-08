import { beforeEach, describe, expect, it } from "@effect/vitest";
import { fetchSourceMarkdown as fetchMarkdown } from "@repo/backend/confect/nina/research/tools/markdown";
import { Effect, Fiber } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";

/** The fetch that Effect's client calls in place of the global one. */
const fetcher = vi.fn<typeof fetch>();

/** Reads one source through the controlled fetch. */
function fetchSourceMarkdown(url: string) {
  return fetchMarkdown(url).pipe(
    Effect.provideService(FetchHttpClient.Fetch, fetcher)
  );
}

describe("source markdown fetcher", () => {
  beforeEach(() => {
    fetcher.mockReset();
  });

  it.effect(
    "reads markdown from the original URL when it is already markdown",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(() =>
          Promise.resolve(
            new Response("  # Direct Source\n\nBody  ", {
              headers: { "content-type": "text/plain" },
            })
          )
        );

        expect(
          yield* fetchSourceMarkdown("https://example.com/source.md")
        ).toBe("# Direct Source\n\nBody");
        expect(fetcher).toHaveBeenCalledWith(
          new URL("https://example.com/source.md"),
          expect.objectContaining({
            headers: {
              accept: "text/markdown,text/plain;q=0.9,text/html;q=0.1",
            },
            redirect: "manual",
          })
        );
      })
  );

  it.effect("skips a redirect instead of following it to another host", () =>
    Effect.gen(function* () {
      fetcher.mockResolvedValue(
        Response.redirect("https://elsewhere.example/source.md", 302)
      );

      expect(
        yield* fetchSourceMarkdown("https://example.com/source.md")
      ).toBeUndefined();
      expect(fetcher).toHaveBeenCalledOnce();
    })
  );

  it.effect("gives up on a source that does not answer in time", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(() => new Promise<Response>(() => undefined));
      const fiber = yield* fetchSourceMarkdown(
        "https://example.com/source.md"
      ).pipe(Effect.forkChild({ startImmediately: true }));

      yield* TestClock.adjust("5 seconds");

      expect(yield* Fiber.join(fiber)).toBeUndefined();
      expect(fetcher.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    })
  );

  it.effect("uses the adjacent markdown URL when the page shell is HTML", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation((input: Parameters<typeof fetch>[0]) => {
        if (String(input) === "https://example.com/docs/page.md") {
          return Promise.resolve(
            new Response("# Page Source", {
              headers: { "content-type": "text/markdown" },
            })
          );
        }

        return Promise.resolve(
          new Response("<html>page shell</html>", {
            headers: { "content-type": "text/html" },
          })
        );
      });

      expect(yield* fetchSourceMarkdown("https://example.com/docs/page")).toBe(
        "# Page Source"
      );
    })
  );

  it.effect(
    "rejects markdown-looking HTML before using adjacent markdown",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation((input: Parameters<typeof fetch>[0]) => {
          if (String(input) === "https://example.com/docs/devtools.md") {
            return Promise.resolve(
              new Response("# DevTools\n\n- Input parameters and prompts", {
                headers: { "content-type": "text/markdown" },
              })
            );
          }

          return Promise.resolve(
            new Response("# DevTools\n\n- Navigation item", {
              headers: { "content-type": "text/html" },
            })
          );
        });

        expect(
          yield* fetchSourceMarkdown("https://example.com/docs/devtools")
        ).toBe("# DevTools\n\n- Input parameters and prompts");
      })
  );

  it.effect("supports trailing slash docs pages with adjacent markdown", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation((input: Parameters<typeof fetch>[0]) => {
        if (String(input) === "https://example.com/docs/page.md") {
          return Promise.resolve(new Response("# Page Source"));
        }

        return Promise.resolve(
          new Response("<!doctype html><html></html>", {
            headers: { "content-type": "text/html" },
          })
        );
      });

      expect(yield* fetchSourceMarkdown("https://example.com/docs/page/")).toBe(
        "# Page Source"
      );
    })
  );

  it.effect(
    "returns empty when root pages do not expose readable markdown",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(() =>
          Promise.resolve(
            new Response("<body>home</body>", {
              headers: { "content-type": "text/html" },
            })
          )
        );

        expect(
          yield* fetchSourceMarkdown("https://example.com/")
        ).toBeUndefined();
      })
  );

  it.effect(
    "accepts markdown-looking content from unknown text-compatible responses",
    () =>
      Effect.gen(function* () {
        fetcher.mockImplementation(() =>
          Promise.resolve(
            new Response("# Source Notes\n\nReadable body.", {
              headers: { "content-type": "application/octet-stream" },
            })
          )
        );

        expect(yield* fetchSourceMarkdown("https://example.com/source")).toBe(
          "# Source Notes\n\nReadable body."
        );
      })
  );

  it.effect("accepts markdown-looking content without a content type", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(() =>
        Promise.resolve(
          new Response(Buffer.from("# Header\n\nBody without content type."))
        )
      );

      expect(yield* fetchSourceMarkdown("https://example.com/source")).toBe(
        "# Header\n\nBody without content type."
      );
    })
  );

  it.effect("rejects unknown responses that do not look like markdown", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(() =>
        Promise.resolve(
          new Response("plain body without markdown structure", {
            headers: { "content-type": "application/octet-stream" },
          })
        )
      );

      expect(
        yield* fetchSourceMarkdown("https://example.com/source")
      ).toBeUndefined();
    })
  );

  it.effect("rejects a source whose body is empty", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(() =>
        Promise.resolve(
          new Response("  \n", { headers: { "content-type": "text/markdown" } })
        )
      );

      expect(
        yield* fetchSourceMarkdown("https://example.com/source.md")
      ).toBeUndefined();
    })
  );

  it.effect("returns empty when source fetches fail", () =>
    Effect.gen(function* () {
      fetcher.mockImplementation(() => Promise.reject(new Error("offline")));

      expect(
        yield* fetchSourceMarkdown("https://example.com/docs/page")
      ).toBeUndefined();
    })
  );

  it.effect("returns empty when response bodies cannot be read", () =>
    Effect.gen(function* () {
      const stream = new ReadableStream({
        start(controller) {
          controller.error(new Error("bad body"));
        },
      });

      fetcher.mockImplementation(() =>
        Promise.resolve(
          new Response(stream, {
            headers: { "content-type": "text/markdown" },
          })
        )
      );

      expect(
        yield* fetchSourceMarkdown("https://example.com/source.md")
      ).toBeUndefined();
    })
  );
});
