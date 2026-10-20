// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { negotiateDocument } from "@/lib/llms/negotiate.server";

const hasLlmsMarkdownSourceMock = vi.hoisted(() => vi.fn());
const getLlmsMarkdownTextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/llms/content/markdown", () => ({
  /** Controls whether a route has a Markdown source. */
  hasLlmsMarkdownSource: hasLlmsMarkdownSourceMock,
  /** Answers the Markdown body of a route with a source. */
  getLlmsMarkdownText: getLlmsMarkdownTextMock,
}));

vi.mock("@/lib/llms/index/generate", () => ({
  /** Section indexes are not part of these cases. */
  getLlmsSectionIndexText: () => Effect.succeed(null),
}));

/** The router's answer in these cases, which varies by its Vary header. */
function router(vary?: string) {
  return Effect.succeed(
    new Response("<html>page</html>", {
      headers: vary === undefined ? {} : { Vary: vary },
      status: 200,
    })
  );
}

/** Negotiates one request against the router answer. */
function negotiate(
  url: string,
  init: { readonly accept?: string; readonly method?: string } = {},
  routed = router()
) {
  const headers: Record<string, string> = {};
  if (init.accept !== undefined) {
    headers.Accept = init.accept;
  }
  return negotiateDocument(
    new Request(`https://nakafa.com${url}`, {
      headers,
      method: init.method ?? "GET",
    }),
    routed
  );
}

/** Reads the body of one answer. */
const bodyOf = (response: Response) => Effect.promise(() => response.text());

beforeEach(() => {
  hasLlmsMarkdownSourceMock.mockReset().mockReturnValue(Effect.succeed(true));
  getLlmsMarkdownTextMock
    .mockReset()
    .mockReturnValue(Effect.succeed("# Source markdown"));
});

describe("document negotiation", () => {
  it.effect("answers the Markdown of a suffixed localized route", () =>
    Effect.gen(function* () {
      const response = yield* negotiate("/en/articles/belajar.md");

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/markdown; charset=utf-8"
      );
      expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
      expect(yield* bodyOf(response)).toBe("# Source markdown");
    })
  );

  it.effect("answers the Markdown of a route that the agent prefers", () =>
    Effect.gen(function* () {
      const response = yield* negotiate("/id/articles/belajar", {
        accept: "text/markdown, text/html;q=0.8",
      });

      expect(yield* bodyOf(response)).toBe("# Source markdown");
    })
  );

  it.effect(
    "delegates an HTML request to the router and varies the answer",
    () =>
      Effect.gen(function* () {
        const response = yield* negotiate(
          "/en/articles/belajar",
          { accept: "text/html" },
          router("Accept-Language")
        );

        expect(yield* bodyOf(response)).toBe("<html>page</html>");
        expect(response.headers.get("vary")).toBe(
          "Accept-Language, Accept, Accept-Encoding"
        );
      })
  );

  it.effect("keeps the status of the router answer", () =>
    Effect.gen(function* () {
      const response = yield* negotiate(
        "/en/articles/belajar",
        { accept: "text/html" },
        Effect.succeed(new Response("moved", { status: 307 }))
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
    })
  );

  it.effect(
    "answers 406 when the agent names no representation the site sends",
    () =>
      Effect.gen(function* () {
        const response = yield* negotiate("/en/articles/belajar", {
          accept: "application/json",
        });

        expect(response.status).toBe(406);
        expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
        expect(yield* bodyOf(response)).toBe("Not Acceptable\n");
      })
  );

  it.effect(
    "answers 406 for Markdown alone on a route with no Markdown source",
    () =>
      Effect.gen(function* () {
        hasLlmsMarkdownSourceMock.mockReturnValue(Effect.succeed(false));

        const response = yield* negotiate("/en/articles/unknown", {
          accept: "text/markdown",
        });

        expect(response.status).toBe(406);
      })
  );

  it.effect("delegates an unlocalized path without a Vary field", () =>
    Effect.gen(function* () {
      const response = yield* negotiate("/api/weather", {
        accept: "application/json",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("vary")).toBeNull();
      expect(hasLlmsMarkdownSourceMock).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "delegates a write request without reading the Markdown source",
    () =>
      Effect.gen(function* () {
        const response = yield* negotiate(
          "/en/articles/belajar",
          { accept: "text/markdown", method: "POST" },
          router()
        );

        expect(response.status).toBe(200);
        expect(hasLlmsMarkdownSourceMock).not.toHaveBeenCalled();
      })
  );

  it.effect("adds the discovery links to a document answer", () =>
    Effect.gen(function* () {
      const response = yield* negotiate("/en/articles/belajar", {
        accept: "text/html",
      });

      expect(response.headers.get("link")).toBe('</llms.txt>; rel="llms-txt"');
      expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
    })
  );

  it.effect("keeps one discovery link on an answer that already names it", () =>
    Effect.gen(function* () {
      const response = yield* negotiate(
        "/en/articles/belajar",
        { accept: "text/html" },
        Effect.succeed(
          new Response("<html>page</html>", {
            headers: {
              Link: '</llms.txt>; rel="llms-txt"',
              "X-Llms-Txt": "/llms.txt",
            },
          })
        )
      );

      expect(response.headers.get("link")).toBe('</llms.txt>; rel="llms-txt"');
      expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
    })
  );

  it.effect(
    "joins the discovery link to the Link values that an answer has",
    () =>
      Effect.gen(function* () {
        const response = yield* negotiate(
          "/en/articles/belajar",
          { accept: "text/html" },
          Effect.succeed(
            new Response("<html>page</html>", {
              headers: { Link: "</fonts/inter.woff2>; rel=preload" },
            })
          )
        );

        expect(response.headers.get("link")).toBe(
          '</fonts/inter.woff2>; rel=preload, </llms.txt>; rel="llms-txt"'
        );
      })
  );
});
