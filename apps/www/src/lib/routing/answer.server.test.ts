// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Data, Effect } from "effect";
import { answerRequest, type RouterHandler } from "@/lib/routing/answer.server";

/** A failure that one of the readers of the server entry reports. */
class ReaderFailure extends Data.TaggedError("ReaderFailure") {}

vi.hoisted(() => {
  vi.stubEnv("AKSARA_PUBLICATION_TOKEN", "test-publication-token");
  vi.stubEnv("SITE_URL", "https://nakafa.com");
});

const markdown = vi.hoisted(() => ({ hasSource: vi.fn(), text: vi.fn() }));
const migration = vi.hoisted(() => ({ read: vi.fn() }));
const projected = vi.hoisted(() => ({ read: vi.fn() }));
const refusal = vi.hoisted(() => ({ read: vi.fn() }));
const reporting = vi.hoisted(() => ({ report: vi.fn() }));
const retired = vi.hoisted(() => ({ read: vi.fn() }));
const source = vi.hoisted(() => ({ read: vi.fn() }));

vi.mock("@/lib/llms/content/markdown", () => ({
  hasLlmsMarkdownSource: markdown.hasSource,
  getLlmsMarkdownText: markdown.text,
}));

vi.mock("@/lib/llms/index/generate", () => ({
  getLlmsSectionIndexText: (key: string) =>
    Effect.succeed(key === "llms/en" ? "# Locale index" : null),
}));

vi.mock("@/lib/routing/public/migration", () => ({
  readPublicUrlMigrationRedirect: migration.read,
}));

vi.mock("@/lib/routing/public/projected", () => ({
  readProjectedHtmlRouteRejection: projected.read,
}));

vi.mock("@/lib/routing/public/retired", () => ({
  readRetiredPublicRoute: retired.read,
}));

vi.mock("@/lib/routing/public/source", () => ({
  readSourceBackedHtmlRouteRejection: source.read,
}));

vi.mock("@/lib/routing/school/refusal", () => ({
  readSchoolRefusal: refusal.read,
}));

vi.mock("@repo/analytics/server-reporting", () => ({
  reportUncaughtRequestError: reporting.report,
}));

vi.mock("@tanstack/react-start/server", () => ({
  handleStartError: () => new Response("Start error", { status: 500 }),
}));

const ORIGIN = "https://nakafa.com";

/** A router that answers the HTML page, and records each request it receives. */
function router() {
  return vi.fn<RouterHandler>(() =>
    Promise.resolve(
      new Response("<html>page</html>", {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    )
  );
}

/** Answers one request through the entry's decisions, with the given router. */
function answer(
  address: string,
  options: {
    readonly accept?: string;
    readonly headers?: Record<string, string>;
    readonly method?: string;
  } = {},
  handle = router()
) {
  const headers = new Headers(options.headers);
  if (options.accept !== undefined) {
    headers.set("accept", options.accept);
  }
  return answerRequest(
    new Request(`${ORIGIN}${address}`, {
      headers,
      method: options.method ?? "GET",
    }),
    handle
  );
}

/** Answers one request and returns the answer with the router that received it. */
function served(
  address: string,
  options: {
    readonly accept?: string;
    readonly headers?: Record<string, string>;
  } = {}
) {
  const handle = router();
  return Effect.map(answer(address, options, handle), (response) => ({
    handle,
    response,
  }));
}

/** The request that the router received in its single call. */
function routedRequest(handle: ReturnType<typeof router>) {
  const [request] = handle.mock.calls[0] ?? [];
  return request;
}

beforeEach(() => {
  markdown.hasSource.mockReset().mockReturnValue(Effect.succeed(true));
  markdown.text
    .mockReset()
    .mockReturnValue(Effect.succeed("# Source markdown"));
  migration.read.mockReset().mockReturnValue(Effect.succeed(null));
  projected.read.mockReset().mockReturnValue(Effect.succeed(null));
  refusal.read.mockReset().mockReturnValue(Effect.succeedNone);
  reporting.report.mockReset().mockReturnValue(Effect.void);
  retired.read.mockReset().mockReturnValue(Effect.succeed(false));
  source.read.mockReset().mockReturnValue(Effect.succeed(null));
});

describe("negotiated representation", () => {
  it.effect("answers the Markdown of a route an agent asks for", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/en/articles/belajar", {
        accept: "text/markdown",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/markdown; charset=utf-8"
      );
      expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
      expect(yield* Effect.promise(() => response.text())).toBe(
        "# Source markdown"
      );
      expect(handle).not.toHaveBeenCalled();
    })
  );

  it.effect("answers the router's HTML for a request that accepts all", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/en/articles/belajar", {
        accept: "*/*",
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/html; charset=utf-8"
      );
      expect(routedRequest(handle).url).toBe(`${ORIGIN}/en/articles/belajar`);
    })
  );

  it.effect("answers the router's HTML when Markdown has no source", () =>
    Effect.gen(function* () {
      markdown.hasSource.mockReturnValue(Effect.succeed(false));

      const { handle, response } = yield* served("/en/articles/belajar", {
        accept: "text/markdown, text/html;q=0.8",
      });

      expect(response.status).toBe(200);
      expect(routedRequest(handle).url).toBe(`${ORIGIN}/en/articles/belajar`);
    })
  );
});

describe("decisions before the negotiation", () => {
  it.effect("moves a trailing slash before any Markdown read", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/en/articles/belajar/", {
        accept: "text/markdown",
      });

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("/en/articles/belajar");
      expect(markdown.hasSource).not.toHaveBeenCalled();
      expect(handle).not.toHaveBeenCalled();
    })
  );

  it.effect("moves a non-public spelling before the negotiation", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/en/curricula/x", {
        accept: "text/markdown",
      });

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("/en/curriculum/x");
      expect(handle).not.toHaveBeenCalled();
    })
  );

  it.effect("moves a migrated address before the negotiation", () =>
    Effect.gen(function* () {
      migration.read.mockReturnValue(
        Effect.succeed({ destination: "/en/@nabil/chat", status: 308 })
      );

      const response = yield* answer("/en/user/abc123/chat", {
        accept: "text/markdown",
      });

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("/en/@nabil/chat");
      expect(response.headers.get("vary")).toBe("Cookie");
    })
  );

  it.effect("moves a moved address before the negotiation", () =>
    Effect.gen(function* () {
      const response = yield* answer("/en/about", { accept: "text/markdown" });

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("/en");
    })
  );

  it.effect("answers a removed address with its not-found page", () =>
    Effect.gen(function* () {
      retired.read.mockReturnValue(Effect.succeed(true));

      const { handle, response } = yield* served("/en/tryout/old", {
        accept: "text/markdown",
      });

      expect(response.headers.get("content-language")).toBe("en");
      expect(routedRequest(handle).url).toBe(`${ORIGIN}/_not-found`);
      expect(routedRequest(handle).headers.get("x-nakafa-locale")).toBe("en");
      expect(markdown.hasSource).not.toHaveBeenCalled();
    })
  );

  it.effect("answers an unowned Markdown route with not found", () =>
    Effect.gen(function* () {
      source.read.mockReturnValue(Effect.succeed("en"));

      const { handle, response } = yield* served("/en/nonexistent-page", {
        accept: "text/markdown",
      });

      expect(response.headers.get("content-language")).toBe("en");
      expect(routedRequest(handle).url).toBe(`${ORIGIN}/_not-found`);
      expect(routedRequest(handle).headers.get("x-nakafa-locale")).toBe("en");
      expect(markdown.hasSource).not.toHaveBeenCalled();
    })
  );

  it.effect("answers an unowned HTML route with not found", () =>
    Effect.gen(function* () {
      projected.read.mockReturnValue(Effect.succeed("en"));

      const { handle, response } = yield* served("/en/subjects/missing", {
        accept: "text/html",
      });

      expect(response.headers.get("content-language")).toBe("en");
      expect(routedRequest(handle).url).toBe(`${ORIGIN}/_not-found`);
      expect(projected.read).toHaveBeenCalledWith({
        hasAttemptCapability: false,
        pathname: "/en/subjects/missing",
      });
    })
  );

  it.effect(
    "answers a school tree path and a raw user address with not found",
    () =>
      Effect.gen(function* () {
        for (const address of ["/en/school/harapan", "/en/user/abc123"]) {
          const { handle } = yield* served(address, { accept: "text/html" });

          expect(routedRequest(handle).url).toBe(`${ORIGIN}/_not-found`);
        }
      })
  );

  it.effect("answers a refused school page with the not-found page", () =>
    Effect.gen(function* () {
      refusal.read.mockReturnValue(Effect.succeedSome("id"));

      const { handle } = yield* served("/en/articles/belajar", {
        accept: "text/html",
      });

      expect(routedRequest(handle).url).toBe(`${ORIGIN}/_not-found`);
      expect(routedRequest(handle).headers.get("x-nakafa-locale")).toBe("id");
    })
  );

  it.effect("answers a refused school page before its migration", () =>
    Effect.gen(function* () {
      refusal.read.mockReturnValue(Effect.succeedSome("id"));
      migration.read.mockReturnValue(
        Effect.succeed({ destination: "/en/@nabil/chat", status: 308 })
      );
      const handle = router();

      const response = yield* answerRequest(
        new Request("https://harapan.nakafa.com/en/user/abc123/chat", {
          headers: { accept: "text/html" },
        }),
        handle
      );

      expect(routedRequest(handle).url).toBe(
        "https://harapan.nakafa.com/_not-found"
      );
      expect(response.headers.get("content-language")).toBe("id");
      expect(migration.read).not.toHaveBeenCalled();
    })
  );

  it.effect("moves a host that names no school to the main site", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served(
        "/en/articles/belajar?ref=app",
        { accept: "text/html", headers: { host: "www.nakafa.com" } }
      );

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        `${ORIGIN}/en/articles/belajar?ref=app`
      );
      expect(handle).not.toHaveBeenCalled();
    })
  );

  it.effect("serves a shared root file on a host that names no school", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/robots.txt", {
        accept: "*/*",
        headers: { host: "www.nakafa.com" },
      });

      expect(response.status).toBe(200);
      expect(routedRequest(handle).url).toBe(`${ORIGIN}/robots.txt`);
    })
  );
});

describe("locale redirects after the negotiation", () => {
  it.effect("answers the root in the negotiated locale with a 307", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/", {
        accept: "text/html",
        headers: { "accept-language": "id-ID,id;q=0.9" },
      });

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/id");
      expect(response.headers.get("vary")).toBe(
        "Accept-Language, Cookie, Accept, Accept-Encoding"
      );
      expect(handle).not.toHaveBeenCalled();
    })
  );

  it.effect("answers the root in Markdown before the locale redirect", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/", {
        accept: "text/markdown",
        headers: { "accept-language": "id" },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe(
        "text/markdown; charset=utf-8"
      );
      expect(yield* Effect.promise(() => response.text())).toBe(
        "# Locale index"
      );
      expect(handle).not.toHaveBeenCalled();
    })
  );
});

describe("social image aliases", () => {
  it.effect("serves a social image alias through the OG route", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served(
        "/en/articles/aljabar.png?ref=share",
        { accept: "image/png" }
      );

      expect(response.status).toBe(200);
      expect(routedRequest(handle).url).toBe(
        `${ORIGIN}/og/en/articles/aljabar?ref=share`
      );
      expect(routedRequest(handle).headers.get("accept")).toBe("image/png");
      expect(markdown.hasSource).not.toHaveBeenCalled();
    })
  );

  it.effect("answers a localized OG image without negotiating it", () =>
    Effect.gen(function* () {
      const { handle } = yield* served("/en/og/articles/aljabar/image.png", {
        accept: "image/png",
      });

      expect(routedRequest(handle).url).toBe(
        `${ORIGIN}/en/og/articles/aljabar/image.png`
      );
      expect(markdown.hasSource).not.toHaveBeenCalled();
    })
  );
});

describe("failures", () => {
  it.effect("reports a router failure with Start's error response", () =>
    Effect.gen(function* () {
      const handle = vi.fn<RouterHandler>(() =>
        Promise.reject(new Error("router failed"))
      );

      const response = yield* answer(
        "/en/articles/belajar",
        { accept: "text/html" },
        handle
      );

      expect(response.status).toBe(500);
      expect(yield* Effect.promise(() => response.text())).toBe("Start error");
      expect(reporting.report).toHaveBeenCalledWith(
        expect.any(Error),
        expect.any(Request)
      );
    })
  );

  it.effect("fails when a removed address cannot be read", () =>
    Effect.gen(function* () {
      retired.read.mockReturnValue(Effect.fail(new ReaderFailure()));

      const error = yield* Effect.flip(answer("/en/tryout/old"));

      expect(error._tag).toBe("UncaughtRequestError");
    })
  );

  it.effect("fails when a migration cannot be read", () =>
    Effect.gen(function* () {
      migration.read.mockReturnValue(Effect.fail(new ReaderFailure()));

      const error = yield* Effect.flip(answer("/en/user/abc123"));

      expect(error._tag).toBe("UncaughtRequestError");
    })
  );

  it.effect("fails when the source cannot own a route", () =>
    Effect.gen(function* () {
      source.read.mockReturnValue(Effect.fail(new ReaderFailure()));

      const error = yield* Effect.flip(answer("/en/nonexistent-page"));

      expect(error._tag).toBe("UncaughtRequestError");
    })
  );

  it.effect("fails when the Markdown source cannot be read", () =>
    Effect.gen(function* () {
      markdown.hasSource.mockReturnValue(Effect.fail(new ReaderFailure()));

      const error = yield* Effect.flip(
        answer("/en/articles/belajar", { accept: "text/markdown" })
      );

      expect(error).toMatchObject({
        _tag: "UncaughtRequestError",
        cause: expect.any(ReaderFailure),
      });
    })
  );

  it.effect("fails when the projection cannot be read", () =>
    Effect.gen(function* () {
      projected.read.mockReturnValue(Effect.fail(new ReaderFailure()));

      const error = yield* Effect.flip(
        answer("/en/subjects/missing", { accept: "text/html" })
      );

      expect(error._tag).toBe("UncaughtRequestError");
    })
  );
});
