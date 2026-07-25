import { Effect } from "effect";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server.js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";
import {
  makePreviewRequest,
  previewRouteEvidence,
} from "@/test/content-preview";

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

/** Creates a local request without repeating the test origin. */
function makeRequest(pathname: string, init?: NextRequestInit) {
  return new NextRequest(`http://localhost:3000${pathname}`, init);
}

/** Runs one local request through the proxy boundary. */
function requestProxy(pathname: string, init?: NextRequestInit) {
  return proxy(makeRequest(pathname, init));
}

/** Verifies that next-intl handled one request. */
function expectLocaleProxy(response: Response) {
  expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
  expect(response.headers.get("x-locale-proxy")).toBe("1");
}

const mockLocaleRouting = vi.hoisted(() => ({
  localeMiddleware: vi.fn(
    () =>
      new Response(null, {
        headers: {
          "x-locale-proxy": "1",
        },
      })
  ),
}));
const runtimeMocks = vi.hoisted(() => ({
  readActive: vi.fn(),
  readActiveIdentity: vi.fn(),
  readContent: vi.fn(),
  readPublic: vi.fn(),
}));
const previewMocks = vi.hoisted(() => ({
  configured: vi.fn(),
  internal: vi.fn(),
  route: vi.fn(),
}));

vi.mock("@repo/internationalization/src/routing", () => ({
  routing: {
    defaultLocale: "en",
    locales: ["en", "id"],
  },
}));

vi.mock("next-intl/middleware", () => ({
  default: vi.fn(() => mockLocaleRouting.localeMiddleware),
}));

vi.mock("@/lib/content/preview/config", () => ({
  hasPreviewConfig: previewMocks.configured,
}));

vi.mock("@/lib/content/preview/route", () => ({
  matchesInternalPreviewRoute: previewMocks.internal,
  matchesPreviewRoute: previewMocks.route,
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: runtimeMocks.readContent,
  getRuntimePublicRoute: runtimeMocks.readPublic,
}));
vi.mock("@/lib/content/published/route", () => ({
  readActiveMaterialRoute: runtimeMocks.readActive,
}));
vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: runtimeMocks.readActiveIdentity,
}));

describe("proxy", () => {
  beforeEach(() => {
    runtimeMocks.readContent
      .mockReset()
      .mockReturnValue(Effect.succeed({ route: "fixture" }));
    runtimeMocks.readPublic
      .mockReset()
      .mockReturnValue(
        Effect.succeed({ kind: "subject-lesson", sitemap: true })
      );
    runtimeMocks.readActive.mockReset().mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-active",
        kind: "unmanaged",
      })
    );
    runtimeMocks.readActiveIdentity
      .mockReset()
      .mockReturnValue(Effect.succeed({ releaseId: "release-active" }));
    previewMocks.configured.mockReset().mockReturnValue(false);
    previewMocks.internal.mockReset().mockReturnValue(Effect.succeed(false));
    previewMocks.route.mockReset().mockReturnValue(Effect.succeed(false));
    mockLocaleRouting.localeMiddleware.mockClear();
  });

  it.each([
    ["/_nakafa/i/v0/e/", { method: "POST" }],
    ["/llms.txt", undefined],
  ])("bypasses locale routing for %s", async (path, init) => {
    const response = await requestProxy(path, init);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
  });

  it.each([
    ["/en/search/", "http://localhost:3000/en/search"],
    [
      "/id/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle?utm=test",
      "http://localhost:3000/id/materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling?utm=test",
    ],
  ])("redirects %s to its canonical URL", async (path, expected) => {
    const response = await requestProxy(path);

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(expected);
  });

  it("runs only unsupported root files through the locale proxy", () => {
    /** Evaluates one URL against the exported proxy matcher. */
    const doesProxyMatch = (url: string) =>
      unstable_doesMiddlewareMatch({ config, url });
    const rootFileExtensions =
      "svg jpg jpeg gif webp glb gltf bin ktx2 hdr exr js css xml webmanifest txt".split(
        " "
      );

    const matched = rootFileExtensions.map(
      (extension) => `/missing.${extension}`
    );
    const bypassed = [
      "/.well-known/llms.txt",
      "/sitemap/base.xml",
      "/llms/en/articles/page/0/llms.txt",
      "/_next/static/chunks/app.js",
      "/models/physics/kinematics/car.svg",
      "/models/physics/kinematics/kenney-car-kit/LICENSE.txt",
      "/models/physics/kinematics/car.glb",
      "/missing.png",
    ];
    expect(
      [...matched, "/MISSING.XML", "/llms.txt"].every(doesProxyMatch)
    ).toBe(true);
    expect(bypassed.some(doesProxyMatch)).toBe(false);
  });

  it("returns a clean 404 for unsupported root files", async () => {
    const response = await requestProxy("/missing-machine-document.xml");
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toBe(
      "text/plain; charset=utf-8"
    );
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
  });

  it("delegates regular routes to the locale middleware", async () => {
    const response = await requestProxy("/en/search");

    expectLocaleProxy(response);
    expect(response.headers.get("link")).toBe('</llms.txt>; rel="llms-txt"');
    expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
  });

  it("lets the selected next-intl preview rewrite reach the actual page", async () => {
    previewMocks.configured.mockReturnValueOnce(true);
    previewMocks.internal.mockReturnValueOnce(Effect.succeed(true));

    const response = await proxy(makePreviewRequest());

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(previewMocks.internal).toHaveBeenCalledWith(previewRouteEvidence);
  });

  it.each([
    [
      "accept header",
      "/en/terms-of-service",
      { headers: { accept: "text/markdown" } },
      "http://localhost:3000/llms.mdx/en/terms-of-service",
    ],
    [
      "explicit suffix",
      "/en/quran/1.md",
      undefined,
      "http://localhost:3000/llms.mdx/en/quran/1",
    ],
  ])(
    "rewrites markdown requests with an %s",
    async (_kind, path, init, expected) => {
      const response = await requestProxy(path, init);

      expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
      expect(response.headers.get("x-middleware-rewrite")).toBe(expected);
    }
  );

  it.each([
    ["/id/quran/999", "http://localhost:3000/id/_not-found", null],
    [
      "/en/curriculum/merdeka/class-11-afdocs-nonexistent-8f3a",
      "http://localhost:3000/en/_not-found",
      "curriculum/merdeka/class-11-afdocs-nonexistent-8f3a",
    ],
  ])(
    "returns a hard 404 for missing HTML route %s",
    async (path, rewrite, projectedPath) => {
      if (projectedPath) {
        runtimeMocks.readPublic.mockReturnValueOnce(Effect.succeed(null));
      }
      const response = await requestProxy(path);

      expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      expect(response.headers.get("x-middleware-rewrite")).toBe(rewrite);
      if (projectedPath) {
        expect(runtimeMocks.readPublic).toHaveBeenCalledWith({
          locale: "en",
          publicPath: projectedPath,
        });
      }
    }
  );

  it.each([
    ["unsupported locale paths", "/fr/quran/1"],
    ["curriculum index routes", "/id/kurikulum"],
  ])("delegates %s to the locale middleware", async (_kind, path) => {
    const response = await requestProxy(path);

    expectLocaleProxy(response);
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
      runtimeMocks.readPublic.mockReturnValueOnce(
        Effect.succeed({ kind, sitemap: true })
      );
      const response = await requestProxy(path);

      expectLocaleProxy(response);
      expect(runtimeMocks.readContent).not.toHaveBeenCalled();
      expect(runtimeMocks.readPublic).toHaveBeenCalledWith({
        locale,
        publicPath,
      });
    }
  );

  it("routes active material additions and rejects owned tombstones", async () => {
    const path = "/en/subjects/mathematics/new-topic/new-published-lesson";
    runtimeMocks.readActive
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-active",
          kind: "found",
        })
      )
      .mockReturnValueOnce(
        Effect.succeed({
          activeReleaseId: "release-active",
          kind: "missing",
        })
      );

    const found = await requestProxy(path);
    expectLocaleProxy(found);
    expect(runtimeMocks.readPublic).not.toHaveBeenCalled();

    mockLocaleRouting.localeMiddleware.mockClear();
    const missing = await requestProxy(path);
    expect(missing.status).toBe(404);
    expect(missing.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(runtimeMocks.readPublic).not.toHaveBeenCalled();
  });

  it.each([
    {
      init: { method: "POST" },
      kind: "non-read content requests without a route lookup",
      path: "/en/articles/politics/not-a-read-check",
    },
    {
      init: undefined,
      kind: "defensive content roots without a route shape",
      path: "/en/unknown-content-root/example",
    },
  ])("delegates $kind", async ({ init, path }) => {
    const response = await requestProxy(path, init);

    expect(runtimeMocks.readContent).not.toHaveBeenCalled();
    expectLocaleProxy(response);
  });
});
