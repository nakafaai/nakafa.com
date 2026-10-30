// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Data, Effect, Option } from "effect";
import { answerRequest } from "@/lib/routing/answer.server";
import type { RouterHandler } from "@/lib/routing/routed.server";

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

vi.mock("@/lib/routing/rendered", async () => {
  const { isBarePath, isRenderedPath } = await import("@/lib/routing/template");
  const { routeRewrite } = await import("@/lib/routing/rewrite");
  /** The Worker's route templates of a stand-in tree, without loading the router. */
  const templates = [
    "/$locale/chat",
    "/$locale/chat/$id",
    "/$locale/search",
    "/$locale/try-out/$country/$exam/$track",
    "/api/weather",
    "/school/$slug/exams",
  ];
  /** The path that the router reads, after its input rewrite. */
  const routerPath = (url: URL) => routeRewrite.input({ url }).pathname;
  return {
    isBareRoutePath: (url: URL) => isBarePath(routerPath(url), templates),
    isBrowserRoutePath: (url: URL) => routerPath(url) === "/en/home",
    isRenderedRoutePath: (url: URL) =>
      !release.hasStaticRelease || isRenderedPath(routerPath(url), templates),
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
  /** The platform's assets binding, which the deployed Worker binds and a prerender does not. */
  env: {
    get ASSETS() {
      return release.hasStaticRelease ? assets : undefined;
    },
  },
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
    readonly headers?: Record<string, string>;
    readonly method?: string;
  } = {},
  handle = router()
) {
  return answerRequest(
    new Request(`${ORIGIN}${address}`, {
      headers: new Headers(options.headers),
      method: options.method ?? "GET",
    }),
    handle
  );
}

/** Answers one request and returns the answer with the router that received it. */
function served(
  address: string,
  options: { readonly headers?: Record<string, string> } = {}
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

/** The not-found page that the router received with its single call, if any. */
function routedNotFound(handle: ReturnType<typeof router>) {
  const [, notFound] = handle.mock.calls[0] ?? [];
  return notFound;
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
    "answers a visitor's try-out set with the page the build wrote, before any content read",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(new Response("<html>set</html>"));

        const { handle, response } = yield* served(
          "/en/try-out/indonesia/snbt/2027/set-1"
        );

        expect(yield* Effect.promise(() => response.text())).toBe(
          "<html>set</html>"
        );
        expect(retired.read).not.toHaveBeenCalled();
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

  it.effect(
    "answers a removed address that no Worker route renders with the static not-found page",
    () =>
      Effect.gen(function* () {
        retired.read.mockReturnValue(Effect.succeed(true));
        assets.fetch.mockResolvedValue(new Response("<h1>Not found</h1>"));

        const { handle, response } = yield* served("/en/tryout/old");

        expect(response.status).toBe(404);
        expect(handle).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers a page in a locale that no Worker route renders before any content read",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(new Response("<h1>Not found</h1>"));
        const { handle, response } = yield* served("/en/nonexistent-page");

        expect(response.status).toBe(404);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(source.read).not.toHaveBeenCalled();
        expect(projected.read).not.toHaveBeenCalled();
        expect(handle).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "answers a rendered route that the projection rejects with its own not-found page",
    () =>
      Effect.gen(function* () {
        projected.read.mockReturnValue(Effect.succeed("en"));

        const { handle } = yield* served("/en/search");

        expect(Option.isSome(routedNotFound(handle))).toBe(true);
        expect(projected.read).toHaveBeenCalledWith({
          hasAttemptCapability: false,
          pathname: "/en/search",
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
        expect(routedRequest(handle).url).toBe(`${ORIGIN}/en/search`);
        expect(Option.isSome(routedNotFound(handle))).toBe(true);
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

  it.effect(
    "answers a page that renders only in the browser with the shell, before any read",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(new Response("<html>shell</html>"));
        const { handle, response } = yield* served("/en/home");

        expect(response.status).toBe(200);
        expect(yield* Effect.promise(() => response.text())).toBe(
          "<html>shell</html>"
        );
        expect(handle).not.toHaveBeenCalled();
        expect(retired.read).not.toHaveBeenCalled();
      })
  );

  it.effect("renders a locale path that a Worker route template names", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served("/en/chat");

      expect(response.status).toBe(200);
      expect(routedRequest(handle).url).toBe(`${ORIGIN}/en/chat`);
      expect(Option.isNone(routedNotFound(handle))).toBe(true);
    })
  );

  it.effect(
    "answers a school tree path and a raw user address with the static not-found page",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(new Response("<h1>Not found</h1>"));
        for (const address of ["/en/school/harapan", "/en/user/abc123"]) {
          const { handle, response } = yield* served(address);

          expect(response.status).toBe(404);
          expect(handle).not.toHaveBeenCalled();
        }
      })
  );

  it.effect("answers a refused school page with the not-found page", () =>
    Effect.gen(function* () {
      refusal.read.mockReturnValue(Effect.succeedSome("id"));

      const { handle } = yield* served("/en/search");

      expect(routedRequest(handle).url).toBe(`${ORIGIN}/en/search`);
      expect(routedNotFound(handle)).toStrictEqual(
        Option.some({ locale: "id", school: false })
      );
    })
  );

  it.effect(
    "answers a refused school page with the static shell before its migration, and a school file with the static page before any read",
    () =>
      Effect.gen(function* () {
        refusal.read.mockReturnValue(Effect.succeedSome("id"));
        migration.read.mockReturnValue(
          Effect.succeed({ destination: "/en/@nabil/chat", status: 308 })
        );
        assets.fetch.mockResolvedValue(new Response("<html>shell</html>"));
        const handle = router();

        const response = yield* answerRequest(
          new Request("https://harapan.nakafa.com/en/user/abc123/chat", {
            headers: { host: "harapan.nakafa.com" },
          }),
          handle
        );

        expect(response.status).toBe(404);
        expect(yield* Effect.promise(() => response.text())).toBe(
          "<html>shell</html>"
        );
        expect(handle).not.toHaveBeenCalled();
        expect(migration.read).not.toHaveBeenCalled();
        assets.fetch.mockResolvedValueOnce(new Response("<h1>Not found</h1>"));
        const file = yield* answerRequest(
          new Request("https://harapan.nakafa.com/.env", {
            headers: { host: "harapan.nakafa.com" },
          }),
          handle
        );
        expect(file.status).toBe(404);
        expect(refusal.read).toHaveBeenCalledOnce();
      })
  );

  it.effect("moves a host that names no school to the main site", () =>
    Effect.gen(function* () {
      const { handle, response } = yield* served(
        "/en/articles/belajar?ref=app",
        { headers: { host: "www.nakafa.com" } }
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
          headers: { "accept-language": "id-ID,id;q=0.9" },
        });

        expect(response.status).toBe(307);
        expect(response.headers.get("location")).toBe("/id");
        expect(response.headers.get("vary")).toBe("Accept-Language, Cookie");
        expect(handle).not.toHaveBeenCalled();
      })
  );

  it.effect(
    "opens a bare page in the visitor's locale or English, after the moved addresses",
    () =>
      Effect.gen(function* () {
        for (const [address, language, location] of [
          ["/quran/2?ref=app", "id-ID,id;q=0.9", "/id/quran/2?ref=app"],
          ["/quran/2", "fr-FR,fr;q=0.9", "/en/quran/2"],
          ["/about", "id", "/"],
        ] as const) {
          const response = yield* answer(address, {
            headers: { "accept-language": language },
          });
          expect(response.headers.get("location")).toBe(location);
        }
      })
  );

  it.effect(
    "answers a bare file and an unserved locale with the static page",
    () =>
      Effect.gen(function* () {
        assets.fetch.mockResolvedValue(new Response("<h1>Not found</h1>"));
        for (const address of ["/wp-login.php", "/fr/subjects", "/EN"]) {
          const { handle, response } = yield* served(address);
          expect(response.status).toBe(404);
          expect(handle).not.toHaveBeenCalled();
        }
      })
  );

  it.effect(
    "leaves a School host's page and a Worker route to the router",
    () =>
      Effect.gen(function* () {
        const handle = router();
        yield* answerRequest(
          new Request("https://harapan.nakafa.com/exams"),
          handle
        );
        expect(routedRequest(handle).url).toBe(
          "https://harapan.nakafa.com/exams"
        );
        const { handle: api } = yield* served("/api/weather");
        expect(api).toHaveBeenCalledTimes(1);
      })
  );
});

describe("failures", () => {
  it.effect("fails with the entry's error when a reader fails", () =>
    Effect.gen(function* () {
      const cases = [
        { address: "/en/tryout/old", options: {}, reader: retired.read },
        { address: "/en/user/abc123", options: {}, reader: migration.read },
        { address: "/en/search", options: {}, reader: source.read },
        { address: "/en/search", options: {}, reader: projected.read },
      ];
      for (const { address, options, reader } of cases) {
        reader.mockReturnValueOnce(Effect.fail(new ReaderFailure()));

        const error = yield* Effect.flip(answer(address, options));

        expect(error._tag).toBe("UncaughtRequestError");
      }
    })
  );
});
