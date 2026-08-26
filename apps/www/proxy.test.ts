import { Effect } from "effect";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server.js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { hasLlmsMarkdownSource } from "@/lib/llms/content";
import { config, proxy } from "@/proxy";

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];
const MARKDOWN_SUFFIX_PATTERN = /\.mdx?$/;

function requestProxy(pathname: string, init?: NextRequestInit) {
  return proxy(new NextRequest(`http://localhost:3000${pathname}`, init));
}

function activeRoute(kind: "found" | "missing" | "unmanaged") {
  return Effect.succeed({ activeReleaseId: "release-active", kind });
}

function expectLocaleProxy(
  response: Response,
  mode: "active" | "preview" = "active"
) {
  const expected = mode === "preview" ? [0, 1, "preview"] : [1, 0, "1"];
  expect([
    mockLocaleRouting.activeMiddleware.mock.calls.length,
    mockLocaleRouting.previewMiddleware.mock.calls.length,
    response.headers.get("x-locale-proxy"),
  ]).toEqual(expected);
}

function expectNoLocaleProxy() {
  expect(mockLocaleRouting.activeMiddleware).not.toHaveBeenCalled();
  expect(mockLocaleRouting.previewMiddleware).not.toHaveBeenCalled();
}

function expectHardNotFound(response: Response, locale: string) {
  expect(response.status).toBe(404);
  expect(response.headers.get("x-middleware-rewrite")).toBe(
    `http://localhost:3000/_not-found/${locale}`
  );
  expect(response.headers.get("x-middleware-request-x-next-intl-locale")).toBe(
    locale
  );
  expectNoLocaleProxy();
}

const mockLocaleRouting = vi.hoisted(() => ({
  activeMiddleware: vi.fn(
    () => new Response(null, { headers: { "x-locale-proxy": "1" } })
  ),
  previewMiddleware: vi.fn(
    () => new Response(null, { headers: { "x-locale-proxy": "preview" } })
  ),
}));
const runtimeMocks = vi.hoisted(() => ({
  readActive: vi.fn(),
  readActiveIdentity: vi.fn(),
  hasArticleCategory: vi.fn(),
  readProgramPath: vi.fn(),
  readRedirect: vi.fn(),
  readTryout: vi.fn(),
}));
const previewMocks = vi.hoisted(() => ({
  configured: vi.fn(),
  internal: vi.fn(),
  pathname: vi.fn(),
  route: vi.fn(),
}));
vi.mock("@repo/internationalization/src/routing", () => ({
  previewRouting: { defaultLocale: "en", locales: ["en", "id", "de", "fr"] },
  routing: { defaultLocale: "en", locales: ["en", "id", "de"] },
}));

vi.mock("@nakafa/aksara-contracts/locale", async (importOriginal) => ({
  ...(await importOriginal()),
  APP_LOCALE_CODES: ["en", "id", "de", "fr"],
}));

vi.mock("next-intl/middleware", () => ({
  default: vi.fn((config: { locales: readonly string[] }) =>
    config.locales.includes("fr")
      ? mockLocaleRouting.previewMiddleware
      : mockLocaleRouting.activeMiddleware
  ),
}));

vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: previewMocks.configured,
}));

vi.mock("@/lib/content/preview/route", () => ({
  matchesInternalPreviewRoute: previewMocks.internal,
  matchesPreviewPathname: previewMocks.pathname,
  matchesPreviewRoute: previewMocks.route,
}));

vi.mock("@/lib/content/runtime/query", () => ({
  readRuntimeQuery: runtimeMocks.readTryout,
}));
vi.mock("@/lib/llms/content", () => ({
  hasLlmsMarkdownSource: (input: Parameters<typeof hasLlmsMarkdownSource>[0]) =>
    Effect.succeed(input.cleanSlug === "terms-of-service"),
}));
vi.mock("@/lib/content/article/category", () => ({
  hasPublishedArticleCategory: runtimeMocks.hasArticleCategory,
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveContentRoute: runtimeMocks.readActive,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: runtimeMocks.readActiveIdentity,
}));
vi.mock("@/lib/content/program/path", () => ({
  readPublishedProgramPath: runtimeMocks.readProgramPath,
}));
vi.mock("@/lib/routing/public/migration", () => ({
  readPublicUrlMigrationRedirect: runtimeMocks.readRedirect,
}));

describe("proxy", () => {
  beforeEach(() => {
    runtimeMocks.readTryout
      .mockReset()
      .mockReturnValue(Effect.succeed({ exists: false }));
    runtimeMocks.readProgramPath
      .mockReset()
      .mockReturnValue(Effect.succeed({ managed: false, route: null }));
    runtimeMocks.readActive
      .mockReset()
      .mockReturnValue(activeRoute("unmanaged"));
    runtimeMocks.readActiveIdentity
      .mockReset()
      .mockReturnValue(Effect.succeed({ releaseId: "release-active" }));
    runtimeMocks.hasArticleCategory
      .mockReset()
      .mockReturnValue(Effect.succeed(true));
    previewMocks.configured.mockReset().mockReturnValue(false);
    previewMocks.internal.mockReset().mockReturnValue(Effect.succeed(false));
    previewMocks.pathname.mockReset().mockReturnValue(Effect.succeed(false));
    previewMocks.route.mockReset().mockReturnValue(Effect.succeed(false));
    runtimeMocks.readRedirect.mockReset().mockReturnValue(Effect.succeed(null));
    mockLocaleRouting.activeMiddleware.mockClear();
    mockLocaleRouting.previewMiddleware.mockClear();
  });

  it.each([
    ["/_nakafa/i/v0/e/", { method: "POST" }],
    ["/llms.txt", undefined],
  ])("bypasses locale routing for %s", async (path, init) => {
    const response = await requestProxy(path, init);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expectNoLocaleProxy();
  });

  it("redirects trailing slashes to the canonical URL", async () => {
    const response = await requestProxy("/en/search/");

    expectNoLocaleProxy();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/search"
    );
  });

  it.each([
    [
      "/id/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle?utm=test",
      "/id/materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling?utm=test",
      { headers: { accept: "application/json" } },
    ],
    [
      "/de/articles/politics/regional-elections-turmoil?source=agent",
      "/de/articles/politik/pilkada-2024-gerichtsurteile-und-kandidaturen?source=agent",
      { headers: { accept: "text/markdown" } },
    ],
    [
      "/de/articles/politics/regional-elections-turmoil.mdx?source=agent",
      "/de/articles/politik/pilkada-2024-gerichtsurteile-und-kandidaturen.mdx?source=agent",
    ],
  ])("permanently redirects %s", async (...args) => {
    const [source, target, init] = args;
    const sourceUrl = new URL(source, "http://localhost:3000");
    const targetUrl = new URL(target, "http://localhost:3000");
    runtimeMocks.readRedirect.mockReturnValueOnce(
      Effect.succeed(targetUrl.pathname.replace(MARKDOWN_SUFFIX_PATTERN, ""))
    );
    const response = await requestProxy(source, init);
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(targetUrl.toString());
    expect(runtimeMocks.readRedirect).toHaveBeenCalledWith({
      method: "GET",
      pathname: sourceUrl.pathname.replace(MARKDOWN_SUFFIX_PATTERN, ""),
    });
  });

  it("matches localized PNG aliases without intercepting static assets", () => {
    const matches = (url: string) =>
      unstable_doesMiddlewareMatch({ config, url });
    const matched =
      "svg jpg jpeg gif webp glb gltf bin ktx2 hdr exr js css xml webmanifest txt"
        .split(" ")
        .map((extension) => `/missing.${extension}`);
    const bypassed = [
      "/.well-known/llms.txt",
      "/sitemap/base.xml",
      "/llms/en/articles/page/0/llms.txt",
      "/_next/static/chunks/app.js",
      "/classes/bacteria.png",
      "/models/physics/kinematics/kenney-car-kit/Textures/colormap.png",
      "/open-graph/curriculum/en-index.png",
      "/missing.png",
      "/_not-found/id",
    ];
    expect([...matched, "/MISSING.XML", "/llms.txt"].every(matches)).toBe(true);
    expect(
      [
        "/en/example.og",
        "/fr/example.png",
        "/FR/example.png",
        "/EN/example.png",
      ].every(matches)
    ).toBe(true);
    expect(bypassed.some(matches)).toBe(false);
  });

  it.each(["/en/example.og", "/en/example.png", "/og/example/image.png"])(
    "delegates the active OG alias %s before document routing",
    async (path) => {
      const response = await requestProxy(path);
      expect(response.headers.get("x-middleware-next")).toBe("1");
      expectNoLocaleProxy();
      expect(runtimeMocks.readActive).not.toHaveBeenCalled();
    }
  );

  it("returns a clean 404 for unsupported root files", async () => {
    const response = await requestProxy("/missing-machine-document.xml");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expectNoLocaleProxy();
  });

  it.each([
    ["/en/search", undefined],
    ["/de/search", { headers: { accept: "text/x-component", rsc: "1" } }],
  ])(
    "delegates the active route %s to the locale middleware",
    async (path, init) => {
      const response = await requestProxy(path, init);
      expectLocaleProxy(response);
      expect(response.headers.get("link")).toBe('</llms.txt>; rel="llms-txt"');
      expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
      expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding, RSC");
    }
  );

  it("uses full contract locale routing only in the configured local child", async () => {
    previewMocks.configured.mockReturnValue(true);
    previewMocks.pathname.mockReturnValueOnce(Effect.succeed(true));
    previewMocks.route.mockReturnValueOnce(Effect.succeed(true));

    const response = await requestProxy(
      "/fr/matieres/mathematiques/fonctions/notion-de-fonction"
    );

    expectLocaleProxy(response, "preview");
  });

  it.each([
    "/fr/search",
    "/fr/school/onboarding/create",
    "/fr/example.og",
    "/fr/example.png",
  ])("hard-rejects the unselected candidate route %s", async (path) => {
    previewMocks.configured.mockReturnValue(true);
    const response = await requestProxy(path);
    expectHardNotFound(response, "fr");
    expect(previewMocks.pathname).toHaveBeenCalledWith(path);
  });

  it.each(["/og/fr/x/image.png", "/FR/example.png", "/EN/example.png"])(
    "hard-rejects the noncanonical localized PNG alias %s",
    async (path) => {
      const response = await requestProxy(path);
      expectHardNotFound(response, "en");
      expect(previewMocks.pathname).not.toHaveBeenCalled();
    }
  );

  it.each([
    [
      "/en/school/select",
      "http://localhost:3000/en/auth?redirect=%2Fen%2Fschool%2Fselect",
    ],
    [
      "/school/onboarding",
      "http://localhost:3000/en/auth?redirect=%2Fen%2Fschool%2Fonboarding",
    ],
  ])(
    "optimistically redirects the protected School route %s",
    async (path, expected) => {
      const response = await requestProxy(path);

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(expected);
      expectNoLocaleProxy();
    }
  );

  it.each(["/en/school", "/en/school/select"])(
    "delegates the available School route %s",
    async (path) => {
      const response = await requestProxy(path, {
        headers: {
          cookie: "better-auth.session_token=fixture-session",
        },
      });

      expectLocaleProxy(response);
    }
  );

  it.each([
    ["missing", undefined],
    ["matching", { headers: { "x-next-intl-locale": "en" } }],
    ["mismatched", { headers: { "x-next-intl-locale": "id" } }],
    ["other active", { headers: { "x-next-intl-locale": "de" } }],
  ])(
    "rejects an internal app route with a %s locale hint",
    async (_kind, init) => {
      const response = await requestProxy(
        "/en/materials/mathematics/functions/function-concept",
        init
      );

      expectHardNotFound(response, "en");
    }
  );

  it("hard-rejects a missing public try-out set before page rendering", async () => {
    const path = "/en/try-out/indonesia/snbt/2027/missing-set";
    runtimeMocks.readTryout.mockReturnValueOnce(Effect.succeed(null));

    const response = await requestProxy(path);

    expectHardNotFound(response, "en");
    expect(runtimeMocks.readTryout).toHaveBeenCalledWith(expect.anything(), {
      input: {
        appLocale: "en",
        kind: "route",
        publicPath: "try-out/indonesia/snbt/2027/missing-set",
      },
    });
  });

  it("delegates one retained attempt capability to the authenticated page", async () => {
    const response = await requestProxy(
      "/en/try-out/indonesia/snbt/2027/set-1?attemptId=attempt-id"
    );

    expectLocaleProxy(response);
    expect(runtimeMocks.readTryout).not.toHaveBeenCalled();
  });

  it.each([
    ["/en", { headers: { "x-next-intl-locale": "en" } }],
    ["/en/search", { headers: { "x-next-intl-locale": "en" } }],
    ["/zz/quran/1", undefined],
    ["/id/kurikulum", undefined],
  ])(
    "does not treat the public route %s as an internal rewrite",
    async (path, init) => {
      const response = await requestProxy(path, init);

      expectLocaleProxy(response);
    }
  );

  it("lets the selected next-intl preview rewrite reach the actual page", async () => {
    previewMocks.configured.mockReturnValueOnce(true);
    previewMocks.internal.mockReturnValueOnce(Effect.succeed(true));
    const pathname = "/fr/materials/mathematiques/fonctions/notion-de-fonction";

    const response = await requestProxy(pathname, {
      headers: { "x-next-intl-locale": "fr" },
    });

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expectNoLocaleProxy();
    expect(previewMocks.internal).toHaveBeenCalledOnce();
    expect(previewMocks.pathname).not.toHaveBeenCalled();
  });

  it.each([
    [
      "accept header",
      "/en/terms-of-service",
      { headers: { accept: "text/markdown" } },
      "http://localhost:3000/llms.mdx/en/terms-of-service",
    ],
    [
      "unacceptable header",
      "/en/terms-of-service",
      { headers: { accept: "text/x-component" } },
      null,
    ],
  ])(
    "negotiates public representations with an %s",
    async (_kind, pathname, init, expected) => {
      runtimeMocks.readActive.mockReturnValueOnce(activeRoute("found"));
      const response = await requestProxy(pathname, init);
      expectNoLocaleProxy();
      expect(response.status).toBe(expected === null ? 406 : 200);
      expect(response.headers.get("x-middleware-rewrite")).toBe(expected);
      expect(response.headers.get("vary")).toBe("Accept, Accept-Encoding, RSC");
    }
  );

  it("returns a hard 404 before rejecting a missing route representation", async () => {
    const response = await requestProxy("/id/quran/999", {
      headers: { accept: "application/json" },
    });

    expectHardNotFound(response, "id");
  });

  it.each([
    [
      "en",
      "/en/subjects/chemistry/green-chemistry/definition",
      "subjects/chemistry/green-chemistry/definition",
      "subject-lesson",
    ],
    [
      "id",
      "/id/kurikulum/merdeka/kelas-10/biologi",
      "kurikulum/merdeka/kelas-10/biologi",
      "curriculum-context",
    ],
  ])(
    "delegates %s/%s to the locale middleware",
    async (locale, path, publicPath, kind) => {
      if (kind === "subject-lesson") {
        runtimeMocks.readActive.mockReturnValueOnce(activeRoute("found"));
      } else {
        runtimeMocks.readProgramPath.mockReturnValueOnce(
          Effect.succeed({ managed: true, route: { sitemap: true } })
        );
      }
      const response = await requestProxy(path);

      expectLocaleProxy(response);
      if (kind === "curriculum-context") {
        expect(runtimeMocks.readProgramPath).toHaveBeenCalledWith(
          locale,
          publicPath
        );
      }
    }
  );

  it("routes active material additions and rejects owned tombstones", async () => {
    const path = "/en/subjects/mathematics/new-topic/new-published-lesson";
    runtimeMocks.readActive
      .mockReturnValueOnce(activeRoute("found"))
      .mockReturnValueOnce(activeRoute("missing"));

    const found = await requestProxy(path);
    expectLocaleProxy(found);

    mockLocaleRouting.activeMiddleware.mockClear();
    const missing = await requestProxy(path);
    expectHardNotFound(missing, "en");
  });

  it("delegates non-read content requests without a route lookup", async () => {
    const response = await requestProxy(
      "/en/articles/politics/not-a-read-check",
      { method: "POST" }
    );

    expectLocaleProxy(response);
  });

  it("hard-rejects an unowned Page path before app streaming", async () => {
    const response = await requestProxy("/en/unknown-content-root/example");

    expectHardNotFound(response, "en");
    expect(runtimeMocks.readActive).toHaveBeenCalledWith({
      activeReleaseId: "release-active",
      appLocale: "en",
      family: "page",
      publicPath: "unknown-content-root/example",
    });
  });
});
