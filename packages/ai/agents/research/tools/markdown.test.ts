import { fetchSourceMarkdown } from "@repo/ai/agents/research/tools/markdown";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("source markdown fetcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads markdown from the original URL when it is already markdown", async () => {
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

    await expect(
      Effect.runPromise(fetchSourceMarkdown("https://example.com/source.md"))
    ).resolves.toBe("# Direct Source\n\nBody");
  });

  it("uses the adjacent markdown URL when the page shell is HTML", async () => {
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

    await expect(
      Effect.runPromise(fetchSourceMarkdown("https://example.com/docs/page"))
    ).resolves.toBe("# Page Source");
  });

  it("rejects markdown-looking HTML before using adjacent markdown", async () => {
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

    await expect(
      Effect.runPromise(
        fetchSourceMarkdown("https://example.com/docs/devtools")
      )
    ).resolves.toBe("# DevTools\n\n- Input parameters and prompts");
  });

  it("supports trailing slash docs pages with adjacent markdown", async () => {
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

    await expect(
      Effect.runPromise(fetchSourceMarkdown("https://example.com/docs/page/"))
    ).resolves.toBe("# Page Source");
  });

  it("returns empty when root pages do not expose readable markdown", async () => {
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

    await expect(
      Effect.runPromise(fetchSourceMarkdown("https://example.com/"))
    ).resolves.toBeUndefined();
  });

  it("accepts markdown-looking content from unknown text-compatible responses", async () => {
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

    await expect(
      Effect.runPromise(fetchSourceMarkdown("https://example.com/source"))
    ).resolves.toBe("# Source Notes\n\nReadable body.");
  });

  it("accepts markdown-looking content without a content type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(Buffer.from("# Header\n\nBody without content type."))
        )
      )
    );

    await expect(
      Effect.runPromise(fetchSourceMarkdown("https://example.com/source"))
    ).resolves.toBe("# Header\n\nBody without content type.");
  });

  it("rejects unknown responses that do not look like markdown", async () => {
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

    await expect(
      Effect.runPromise(fetchSourceMarkdown("https://example.com/source"))
    ).resolves.toBeUndefined();
  });

  it("returns empty when source fetches fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline")))
    );

    await expect(
      Effect.runPromise(fetchSourceMarkdown("https://example.com/docs/page"))
    ).resolves.toBeUndefined();
  });

  it("returns empty when response bodies cannot be read", async () => {
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

    await expect(
      Effect.runPromise(fetchSourceMarkdown("https://example.com/source.md"))
    ).resolves.toBeUndefined();
  });
});
