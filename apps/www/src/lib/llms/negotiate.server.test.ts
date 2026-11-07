// @vitest-environment node

import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  answerNotFoundDocument,
  answerRootDocument,
} from "@/lib/llms/negotiate.server";

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which answers the locale home's Markdown twin. */
  env: { ASSETS: assets },
}));

const MARKDOWN = "text/markdown; charset=utf-8";

/** The root redirect that the Worker answers a browser with. */
function rootRedirect() {
  return new Response(null, {
    headers: { location: "/id", vary: "Accept-Language, Cookie" },
    status: 307,
  });
}

/** A request for an address with the Accept field and language that an agent sends. */
function read(
  address: string,
  accept: string | null,
  init: { readonly method?: string } = {}
) {
  const headers = new Headers({ "accept-language": "id-ID,id;q=0.9" });
  if (accept !== null) {
    headers.set("accept", accept);
  }
  return new Request(`https://nakafa.com${address}`, { ...init, headers });
}

/** The static not-found page that the Worker answers an unknown address with. */
function htmlNotFound() {
  return new Response("<h1>Page not found</h1>", {
    headers: {
      "content-length": "24",
      "content-type": "text/html; charset=utf-8",
    },
    status: 404,
  });
}

describe("root document", () => {
  it.effect(
    "answers an agent that asks for Markdown with the locale home's twin at the root",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(
          new Response("# Nakafa", {
            headers: { "cache-control": "public, max-age=0" },
          })
        );

        const response = yield* answerRootDocument(
          read("/", "text/markdown"),
          rootRedirect()
        );

        expect(assets.fetch.mock.lastCall?.[0].url).toBe(
          "https://nakafa.com/id.md"
        );
        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(MARKDOWN);
        expect(response.headers.get("content-location")).toBe("/id.md");
        expect(response.headers.get("vary")).toBe(
          "Accept-Language, Cookie, Accept"
        );
        expect(yield* Effect.promise(() => response.text())).toBe("# Nakafa");
      })
  );

  it.effect(
    "keeps the redirect for a browser, a tie, a request without Accept and a write",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockClear();
        for (const request of [
          read("/", "text/html,application/xhtml+xml,*/*;q=0.8"),
          read("/", "text/markdown, text/html"),
          read("/", null),
          read("/", "text/markdown", { method: "POST" }),
        ]) {
          const response = yield* answerRootDocument(request, rootRedirect());

          expect(response.status).toBe(307);
          expect(response.headers.get("location")).toBe("/id");
          expect(response.headers.get("vary")).toBe(
            "Accept-Language, Cookie, Accept"
          );
        }
        expect(assets.fetch).not.toHaveBeenCalled();
      })
  );

  it.effect("keeps the redirect when the locale home has no twin", () =>
    Effect.gen(function* () {
      assets.fetch.mockResolvedValue(new Response("missing", { status: 404 }));

      const response = yield* answerRootDocument(
        read("/", "text/markdown, text/html;q=0.9"),
        rootRedirect()
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/id");
    })
  );
});

describe("not-found document", () => {
  it.effect(
    "answers an agent that asks for Markdown with a Markdown page and the same 404",
    () =>
      Effect.gen(function* () {
        for (const method of ["GET", "HEAD"]) {
          const response = yield* answerNotFoundDocument(
            read("/id/no-such-page", "text/markdown", { method }),
            htmlNotFound()
          );
          const body = yield* Effect.promise(() => response.text());

          expect(response.status).toBe(404);
          expect(response.headers.get("content-type")).toBe(MARKDOWN);
          expect(response.headers.get("cache-control")).toBe("no-store");
          expect(response.headers.get("content-length")).toBeNull();
          expect(response.headers.get("vary")).toBe("Accept");
          if (method === "GET") {
            expect(body).toContain("# Page not found");
            expect(body).toContain("https://nakafa.com/llms.txt");
            expect(body).toContain("https://nakafa.com/sitemap.xml");
          }
        }
      })
  );

  it.effect(
    "keeps the HTML page for a browser and says that it depends on Accept",
    () =>
      Effect.gen(function* () {
        const response = yield* answerNotFoundDocument(
          read("/id/no-such-page", "text/html,*/*;q=0.8"),
          htmlNotFound()
        );

        expect(response.status).toBe(404);
        expect(response.headers.get("content-type")).toBe(
          "text/html; charset=utf-8"
        );
        expect(response.headers.get("vary")).toBe("Accept");
        expect(yield* Effect.promise(() => response.text())).toBe(
          "<h1>Page not found</h1>"
        );
      })
  );

  it.effect("leaves every answer that is not a 404 as it is", () =>
    Effect.gen(function* () {
      const page = new Response("<h1>Nakafa</h1>", { status: 200 });

      const response = yield* answerNotFoundDocument(
        read("/id", "text/markdown"),
        page
      );

      expect(response).toBe(page);
    })
  );

  it.effect("answers a not-found answer without a body as Markdown", () =>
    Effect.gen(function* () {
      const response = yield* answerNotFoundDocument(
        read("/id/no-such-page", "text/markdown"),
        new Response(null, { status: 404 })
      );

      expect(response.headers.get("content-type")).toBe(MARKDOWN);
      expect(yield* Effect.promise(() => response.text())).toContain(
        "# Page not found"
      );
    })
  );
});
