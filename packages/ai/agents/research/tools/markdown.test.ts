import { afterEach, describe, expect, it } from "@effect/vitest";
import { fetchSourceMarkdown } from "@repo/ai/agents/research/tools/markdown";
import { Effect } from "effect";

describe("source markdown fetcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.effect(
    "reads markdown from the original URL when it is already markdown",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          "fetch",
          vi.fn(() =>
            Promise.resolve(
              new Response("  # Direct Source\n\nBody  ", {
                headers: { "content-type": "text/plain" },
              })
            )
          )
        );

        expect(
          yield* fetchSourceMarkdown("https://example.com/source.md")
        ).toBe("# Direct Source\n\nBody");
      })
  );

  it.effect("uses the adjacent markdown URL when the page shell is HTML", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn((input: Parameters<typeof fetch>[0]) => {
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
        })
      );

      expect(yield* fetchSourceMarkdown("https://example.com/docs/page")).toBe(
        "# Page Source"
      );
    })
  );

  it.effect(
    "rejects markdown-looking HTML before using adjacent markdown",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          "fetch",
          vi.fn((input: Parameters<typeof fetch>[0]) => {
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
          })
        );

        expect(
          yield* fetchSourceMarkdown("https://example.com/docs/devtools")
        ).toBe("# DevTools\n\n- Input parameters and prompts");
      })
  );

  it.effect("supports trailing slash docs pages with adjacent markdown", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn((input: Parameters<typeof fetch>[0]) => {
          if (String(input) === "https://example.com/docs/page.md") {
            return Promise.resolve(new Response("# Page Source"));
          }

          return Promise.resolve(
            new Response("<!doctype html><html></html>", {
              headers: { "content-type": "text/html" },
            })
          );
        })
      );

      expect(yield* fetchSourceMarkdown("https://example.com/docs/page/")).toBe(
        "# Page Source"
      );
    })
  );

  it.effect(
    "returns empty when root pages do not expose readable markdown",
    () =>
      Effect.gen(function* () {
        vi.stubGlobal(
          "fetch",
          vi.fn(() =>
            Promise.resolve(
              new Response("<body>home</body>", {
                headers: { "content-type": "text/html" },
              })
            )
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
        vi.stubGlobal(
          "fetch",
          vi.fn(() =>
            Promise.resolve(
              new Response("# Source Notes\n\nReadable body.", {
                headers: { "content-type": "application/octet-stream" },
              })
            )
          )
        );

        expect(yield* fetchSourceMarkdown("https://example.com/source")).toBe(
          "# Source Notes\n\nReadable body."
        );
      })
  );

  it.effect("accepts markdown-looking content without a content type", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            new Response(Buffer.from("# Header\n\nBody without content type."))
          )
        )
      );

      expect(yield* fetchSourceMarkdown("https://example.com/source")).toBe(
        "# Header\n\nBody without content type."
      );
    })
  );

  it.effect("rejects unknown responses that do not look like markdown", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            new Response("plain body without markdown structure", {
              headers: { "content-type": "application/octet-stream" },
            })
          )
        )
      );

      expect(
        yield* fetchSourceMarkdown("https://example.com/source")
      ).toBeUndefined();
    })
  );

  it.effect("returns empty when source fetches fail", () =>
    Effect.gen(function* () {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("offline")))
      );

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

      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve(
            new Response(stream, {
              headers: { "content-type": "text/markdown" },
            })
          )
        )
      );

      expect(
        yield* fetchSourceMarkdown("https://example.com/source.md")
      ).toBeUndefined();
    })
  );
});
