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

const migration = vi.hoisted(() => ({ read: vi.fn() }));
const projected = vi.hoisted(() => ({ read: vi.fn() }));
const refusal = vi.hoisted(() => ({ read: vi.fn() }));
const reporting = vi.hoisted(() => ({ report: vi.fn() }));
const retired = vi.hoisted(() => ({ read: vi.fn() }));
const source = vi.hoisted(() => ({ read: vi.fn() }));

const release = vi.hoisted(() => ({ hasStaticRelease: true }));

vi.mock("@/lib/routing/release", () => ({
  /** Reads the flag of the test, so one test can run without the static release. */
  get HAS_STATIC_RELEASE() {
    return release.hasStaticRelease;
  },
}));

vi.mock("@/lib/routing/rendered", async () => {
  const { isRenderedPath } = await import("@/lib/routing/template");
  return {
    /** Names the Worker's route templates of a stand-in tree, without loading the router. */
    isRenderedRoutePath: (pathname: string) =>
      isRenderedPath(pathname, [
        "/$locale/chat",
        "/$locale/chat/$id",
        "/$locale/search",
        "/$locale/try-out/$country/$exam/$track",
      ]),
  };
});

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

const assets = vi.hoisted(() => ({
  fetch: vi.fn<(request: Request) => Promise<Response>>(),
}));

vi.mock("cloudflare:workers", () => ({
  /** The platform's assets binding, which answers the static not-found page. */
  env: { ASSETS: assets },
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
  release.hasStaticRelease = true;
  assets.fetch.mockReset();
  migration.read.mockReset().mockReturnValue(Effect.succeed(null));
  projected.read.mockReset().mockReturnValue(Effect.succeed(null));
  refusal.read.mockReset().mockReturnValue(Effect.succeedNone);
  reporting.report.mockReset().mockReturnValue(Effect.void);
  retired.read.mockReset().mockReturnValue(Effect.succeed(false));
  source.read.mockReset().mockReturnValue(Effect.succeed(null));
});

describe("decisions before the router", () => {
  it.effect(
    "answers an address that names no route with the static not-found page",
    () =>
      Effect.gen(function* () {
        const page = new Response("<h1>Page not found</h1>", { status: 404 });
        assets.fetch.mockResolvedValue(page);
        const { handle, response } = yield* served("/.env");

        expect(response.status).toBe(404);
        expect(assets.fetch).toHaveBeenCalledTimes(1);
        expect(handle).not.toHaveBeenCalled();
      })
  );

  it.effect("moves a trailing slash before the router", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/en/articles/belajar/");

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("/en/articles/belajar");
      expect(handle).not.toHaveBeenCalled();
    })
  );

  it.effect("moves a non-public spelling before the router", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/en/curricula/x");

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("/en/curriculum/x");
      expect(handle).not.toHaveBeenCalled();
    })
  );

  it.effect("moves a migrated address before the router", () =>
    Effect.gen(function* () {
      migration.read.mockReturnValue(
        Effect.succeed({ destination: "/en/@nabil/chat", status: 308 })
      );

      const response = yield* answer("/en/user/abc123/chat");

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("/en/@nabil/chat");
      expect(response.headers.get("vary")).toBe("Cookie");
    })
  );

  it.effect("moves a moved address before the router", () =>
    Effect.gen(function* () {
      const response = yield* answer("/en/about");

      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("/en");
    })
  );

  it.effect("answers a removed address with its not-found page", () =>
    Effect.gen(function* () {
      retired.read.mockReturnValue(Effect.succeed(true));

      const { handle, response } = yield* served("/en/tryout/old");

      expect(response.headers.get("content-language")).toBe("en");
      expect(routedRequest(handle).url).toBe(`${ORIGIN}/_missing`);
      expect(routedRequest(handle).headers.get("x-nakafa-locale")).toBe("en");
    })
  );

  it.effect("answers an unowned route with the static not-found page", () =>
    Effect.gen(function* () {
      source.read.mockReturnValue(Effect.succeed("en"));
      assets.fetch.mockResolvedValue(new Response("<h1>Not found</h1>"));
      const { handle, response } = yield* served("/en/nonexistent-page");

      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(assets.fetch).toHaveBeenCalledTimes(1);
      expect(handle).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "answers an unowned HTML route with the static not-found page",
    () =>
      Effect.gen(function* () {
        projected.read.mockReturnValue(Effect.succeed("en"));
        assets.fetch.mockResolvedValue(new Response("<h1>Not found</h1>"));

        const { handle, response } = yield* served("/en/subjects/missing", {
          accept: "text/html",
        });

        expect(response.status).toBe(404);
        expect(handle).not.toHaveBeenCalled();
        expect(projected.read).toHaveBeenCalledWith({
          hasAttemptCapability: false,
          pathname: "/en/subjects/missing",
        });
      })
  );

  it.effect(
    "answers a locale path that no route renders with the static page",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(new Response("<h1>Not found</h1>"));

        for (const address of [
          "/en/wp-login.php",
          "/en/articles/gone-xyz.md",
        ]) {
          const { handle, response } = yield* served(address);

          expect(response.status).toBe(404);
          expect(handle).not.toHaveBeenCalled();
        }
        expect(assets.fetch).toHaveBeenCalledTimes(2);
      })
  );

  it.effect(
    "answers a rejection of a rendered route with its own not-found page",
    () =>
      Effect.gen(function* () {
        source.read.mockReturnValue(Effect.succeed("en"));

        const { handle, response } = yield* served("/en/search");

        expect(response.headers.get("content-language")).toBe("en");
        expect(routedRequest(handle).url).toBe(`${ORIGIN}/_missing`);
      })
  );

  it.effect(
    "renders an unknown address when the build has no static release",
    () =>
      Effect.gen(function* () {
        release.hasStaticRelease = false;

        const { handle, response } = yield* served("/.env");

        expect(response.status).toBe(200);
        expect(assets.fetch).not.toHaveBeenCalled();
        expect(handle).toHaveBeenCalledTimes(1);
      })
  );

  it.effect("renders a locale path that a Worker route template names", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/en/chat", {
        accept: "text/html",
      });

      expect(response.status).toBe(200);
      expect(routedRequest(handle).url).toBe(`${ORIGIN}/en/chat`);
    })
  );

  it.effect("moves a bare profile address to the negotiated locale", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/@nabil", {
        headers: { "accept-language": "id" },
      });

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("/id/@nabil");
      expect(handle).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "answers a school tree path and a raw user address with not found",
    () =>
      Effect.gen(function* () {
        for (const address of ["/en/school/harapan", "/en/user/abc123"]) {
          const { handle } = yield* served(address, { accept: "text/html" });

          expect(routedRequest(handle).url).toBe(`${ORIGIN}/_missing`);
        }
      })
  );

  it.effect("answers a refused school page with the not-found page", () =>
    Effect.gen(function* () {
      refusal.read.mockReturnValue(Effect.succeedSome("id"));

      const { handle } = yield* served("/en/articles/belajar", {
        accept: "text/html",
      });

      expect(routedRequest(handle).url).toBe(`${ORIGIN}/_missing`);
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
        "https://harapan.nakafa.com/_missing"
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
});

describe("locale redirects", () => {
  it.effect(
    "answers the root in the locale that the request names with a 307",
    () =>
      Effect.gen(function* () {
        const { handle, response } = yield* served("/", {
          accept: "text/html",
          headers: { "accept-language": "id-ID,id;q=0.9" },
        });

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("/id");
        expect(response.headers.get("vary")).toBe("Accept-Language, Cookie");
        expect(handle).not.toHaveBeenCalled();
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
        "/en/search",
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
