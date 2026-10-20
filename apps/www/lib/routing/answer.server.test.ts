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
const retired = vi.hoisted(() => ({ read: vi.fn() }));
const refusal = vi.hoisted(() => ({ read: vi.fn() }));
const reporting = vi.hoisted(() => ({ report: vi.fn() }));

vi.mock("@/lib/llms/content/markdown", () => ({
  /** Controls whether a route has a Markdown source. */
  hasLlmsMarkdownSource: markdown.hasSource,
  /** Answers the Markdown body of a route with a source. */
  getLlmsMarkdownText: markdown.text,
}));

vi.mock("@/lib/llms/index/generate", () => ({
  /** Answers the English locale index, which is the Markdown of the root address. */
  getLlmsSectionIndexText: (key: string) =>
    Effect.succeed(key === "llms/en" ? "# Locale index" : null),
}));

vi.mock("@/lib/routing/public/migration", () => ({
  /** Controls the successor of a retired address. */
  readPublicUrlMigrationRedirect: migration.read,
}));

vi.mock("@/lib/routing/public/retired", () => ({
  /** Controls whether an address is removed for good. */
  readRetiredPublicRoute: retired.read,
}));

vi.mock("@/lib/routing/school/refusal", () => ({
  /** Controls whether a school refuses the page of its address. */
  readSchoolRefusal: refusal.read,
}));

vi.mock("@repo/analytics/server-reporting", () => ({
  /** Records each failure that the router leaves unanswered. */
  reportUncaughtRequestError: reporting.report,
}));

vi.mock("@tanstack/react-start/server", () => ({
  /** Answers the error response that Start gives a failure that escapes. */
  handleStartError: () => new Response("Start error", { status: 500 }),
}));

const ORIGIN = "https://nakafa.com";
const LLMS_LINK = '</llms.txt>; rel="llms-txt"';

/** The router's HTML page, which every request that reaches the router receives. */
function page() {
  return new Response("<html>page</html>", {
    headers: { "Content-Type": "text/html; charset=utf-8" },
    status: 200,
  });
}

/** A router that answers the page and records each request it receives. */
function router() {
  return vi.fn<RouterHandler>(() => Promise.resolve(page()));
}

/** Answers one request through the server entry's decisions, with the given router. */
function answer(
  address: string,
  init: {
    readonly accept?: string;
    readonly headers?: Record<string, string>;
    readonly method?: string;
  } = {},
  handle = router()
) {
  const headers = new Headers(init.headers);
  if (init.accept !== undefined) {
    headers.set("accept", init.accept);
  }
  return answerRequest(
    new Request(`${ORIGIN}${address}`, {
      headers,
      method: init.method ?? "GET",
    }),
    handle
  );
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
  retired.read.mockReset().mockReturnValue(Effect.succeed(false));
  refusal.read.mockReset().mockReturnValue(Effect.succeedNone);
  reporting.report.mockReset().mockReturnValue(Effect.void);
});

describe("negotiated representation", () => {
  it.effect(
    "answers the Markdown of a route that an agent asks for, with the discovery links",
    () =>
      Effect.gen(function* () {
        const handle = router();
        const response = yield* answer(
          "/en/articles/belajar",
          { accept: "text/markdown" },
          handle
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(
          "text/markdown; charset=utf-8"
        );
        expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
        expect(response.headers.get("link")).toBe(LLMS_LINK);
        expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
        expect(yield* Effect.promise(() => response.text())).toBe(
          "# Source markdown"
        );
        expect(handle).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers the router's HTML for an HTML request, with the same Vary and discovery links",
    () =>
      Effect.gen(function* () {
        const handle = router();
        const response = yield* answer(
          "/en/articles/belajar",
          { accept: "text/html" },
          handle
        );

        expect(response.status).toBe(200);
        expect(yield* Effect.promise(() => response.text())).toBe(
          "<html>page</html>"
        );
        expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
        expect(response.headers.get("link")).toBe(LLMS_LINK);
        expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
        expect(routedRequest(handle).url).toBe(`${ORIGIN}/en/articles/belajar`);
        expect(markdown.hasSource).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers the router's HTML for a request that accepts anything",
    () =>
      Effect.gen(function* () {
        const handle = router();
        const response = yield* answer(
          "/en/articles/belajar",
          { accept: "*/*" },
          handle
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(
          "text/html; charset=utf-8"
        );
        expect(response.headers.get("link")).toBe(LLMS_LINK);
        expect(routedRequest(handle).url).toBe(`${ORIGIN}/en/articles/belajar`);
      })
  );

  it.effect(
    "answers the Markdown when the agent prefers it over HTML of lower quality",
    () =>
      Effect.gen(function* () {
        const handle = router();
        const response = yield* answer(
          "/id/articles/belajar",
          { accept: "text/markdown, text/html;q=0.8" },
          handle
        );

        expect(response.headers.get("content-type")).toBe(
          "text/markdown; charset=utf-8"
        );
        expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
        expect(response.headers.get("link")).toBe(LLMS_LINK);
        expect(handle).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers the Markdown of a .md address whatever the Accept header names",
    () =>
      Effect.gen(function* () {
        const handle = router();
        const response = yield* answer(
          "/en/articles/belajar.md",
          { accept: "text/html" },
          handle
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe(
          "text/markdown; charset=utf-8"
        );
        expect(response.headers.get("link")).toBe(LLMS_LINK);
        expect(handle).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers 406 to a representation the site cannot send, with Vary and no discovery links",
    () =>
      Effect.gen(function* () {
        const handle = router();
        const response = yield* answer(
          "/en/articles/belajar",
          { accept: "application/json" },
          handle
        );

        expect(response.status).toBe(406);
        expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding");
        expect(response.headers.get("link")).toBeNull();
        expect(handle).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers 406 to Markdown alone on a route with no Markdown source",
    () =>
      Effect.gen(function* () {
        markdown.hasSource.mockReturnValue(Effect.succeed(false));

        const response = yield* answer("/en/articles/belajar", {
          accept: "text/markdown",
        });

        expect(response.status).toBe(406);
      })
  );

  it.effect(
    "answers the router's HTML when Markdown is preferred but the route has no Markdown source",
    () =>
      Effect.gen(function* () {
        markdown.hasSource.mockReturnValue(Effect.succeed(false));
        const handle = router();

        const response = yield* answer(
          "/en/articles/belajar",
          { accept: "text/markdown, text/html;q=0.8" },
          handle
        );

        expect(response.status).toBe(200);
        expect(routedRequest(handle).url).toBe(`${ORIGIN}/en/articles/belajar`);
      })
  );
});

describe("decisions before the negotiation", () => {
  it.effect(
    "moves a trailing slash to its canonical address before any Markdown read",
    () =>
      Effect.gen(function* () {
        const handle = router();
        const response = yield* answer(
          "/en/articles/belajar/",
          { accept: "text/markdown" },
          handle
        );

        expect(response.status).toBe(308);
        expect(response.headers.get("location")).toBe("/en/articles/belajar");
        expect(markdown.hasSource).not.toHaveBeenCalled();
        expect(handle).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "moves a migrated address to its successor instead of refusing its representation",
    () =>
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

  it.effect(
    "moves an address that the product moved before the negotiation answers it",
    () =>
      Effect.gen(function* () {
        const response = yield* answer("/en/about", {
          accept: "text/markdown",
        });

        expect(response.status).toBe(308);
        expect(response.headers.get("location")).toBe("/en");
      })
  );

  it.effect(
    "answers a removed address with the not-found page of its locale",
    () =>
      Effect.gen(function* () {
        retired.read.mockReturnValue(Effect.succeed(true));
        const handle = router();

        const response = yield* answer(
          "/en/tryout/old",
          { accept: "text/markdown" },
          handle
        );

        expect(response.headers.get("content-language")).toBe("en");
        expect(routedRequest(handle).url).toBe(`${ORIGIN}/_not-found`);
        expect(routedRequest(handle).headers.get("x-nakafa-locale")).toBe("en");
        expect(markdown.hasSource).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers a school tree path of the main site with the not-found page",
    () =>
      Effect.gen(function* () {
        const handle = router();

        yield* answer("/en/school/harapan", { accept: "text/html" }, handle);

        expect(routedRequest(handle).url).toBe(`${ORIGIN}/_not-found`);
      })
  );

  it.effect(
    "answers a raw user address that is no profile with the not-found page",
    () =>
      Effect.gen(function* () {
        const handle = router();

        yield* answer("/en/user/abc123", { accept: "text/html" }, handle);

        expect(routedRequest(handle).url).toBe(`${ORIGIN}/_not-found`);
      })
  );

  it.effect(
    "answers a page that its school refuses with the not-found page of the negotiated locale",
    () =>
      Effect.gen(function* () {
        refusal.read.mockReturnValue(Effect.succeedSome("id"));
        const handle = router();

        yield* answer("/en/articles/belajar", { accept: "text/html" }, handle);

        expect(routedRequest(handle).url).toBe(`${ORIGIN}/_not-found`);
        expect(routedRequest(handle).headers.get("x-nakafa-locale")).toBe("id");
      })
  );

  it.effect(
    "moves a host under the production domain that names no school to the main site",
    () =>
      Effect.gen(function* () {
        const handle = router();

        const response = yield* answer(
          "/en/articles/belajar?ref=app",
          { accept: "text/html", headers: { host: "www.nakafa.com" } },
          handle
        );

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe(
          `${ORIGIN}/en/articles/belajar?ref=app`
        );
        expect(handle).not.toHaveBeenCalled();
      })
  );
});

describe("locale redirects after the negotiation", () => {
  it.effect(
    "answers the root with the negotiated locale and a 307 that varies by locale and representation",
    () =>
      Effect.gen(function* () {
        const handle = router();

        const response = yield* answer(
          "/",
          {
            accept: "text/html",
            headers: { "accept-language": "id-ID,id;q=0.9" },
          },
          handle
        );

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("/id");
        expect(response.headers.get("vary")).toBe(
          "Accept-Language, Cookie, Accept, Accept-Encoding"
        );
        expect(handle).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers the root in Markdown before the locale redirect when the root has a Markdown source",
    () =>
      Effect.gen(function* () {
        const handle = router();

        const response = yield* answer(
          "/",
          {
            accept: "text/markdown",
            headers: { "accept-language": "id" },
          },
          handle
        );

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

describe("failures", () => {
  it.effect("reports a router failure and answers Start's error response", () =>
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

  it.effect(
    "fails with the uncaught error when a removed address cannot be read",
    () =>
      Effect.gen(function* () {
        retired.read.mockReturnValue(Effect.fail(new ReaderFailure()));

        const error = yield* Effect.flip(answer("/en/tryout/old"));

        expect(error._tag).toBe("UncaughtRequestError");
      })
  );

  it.effect(
    "fails with the uncaught error when a migration cannot be read",
    () =>
      Effect.gen(function* () {
        migration.read.mockReturnValue(Effect.fail(new ReaderFailure()));

        const error = yield* Effect.flip(answer("/en/user/abc123"));

        expect(error._tag).toBe("UncaughtRequestError");
      })
  );
});
