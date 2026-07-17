import { Effect } from "effect";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server.js";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { config, proxy } from "@/proxy";

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
  readContent: vi.fn(),
  readPublic: vi.fn(),
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

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRoute: runtimeMocks.readContent,
  getRuntimePublicRoute: runtimeMocks.readPublic,
}));

describe("proxy", () => {
  beforeEach(() => {
    runtimeMocks.readContent.mockReset();
    runtimeMocks.readPublic.mockReset();
    runtimeMocks.readContent.mockReturnValue(
      Effect.succeed({ route: "fixture" })
    );
    runtimeMocks.readPublic.mockReturnValue(
      Effect.succeed({ kind: "subject-lesson", sitemap: true })
    );
    mockLocaleRouting.localeMiddleware.mockClear();
  });

  it("bypasses locale routing for PostHog proxy requests", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/_nakafa/i/v0/e/", {
        method: "POST",
      })
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("keeps canonical no-slash URLs for application routes", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/search/")
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/en/search"
    );
  });

  it("bypasses locale routing for public discovery endpoints", async () => {
    const paths = [
      "/mcp",
      "/llms.txt",
      "/logo.svg",
      "/manifest.webmanifest",
      "/robots.txt",
      "/rss.xml",
      "/sitemap.txt",
      "/sitemap.xml",
      "/skill.md",
      "/e22d548f7fd2482a9022e3b84e944901.txt",
      "/.well-known/llms.txt",
      "/.well-known/agent-skills/index.json",
      "/.well-known/agent-skills/nakafa/SKILL.md",
    ];

    for (const path of paths) {
      const response = await proxy(
        new NextRequest(`http://localhost:3000${path}`)
      );

      expect(response.headers.get("x-middleware-next")).toBe("1");
    }

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
  });

  it("runs only unsupported root files through the locale proxy", () => {
    const doesProxyMatch = (url: string) =>
      unstable_doesMiddlewareMatch({ config, url });
    const rootFileExtensions = [
      "svg",
      "jpg",
      "jpeg",
      "gif",
      "webp",
      "glb",
      "gltf",
      "bin",
      "ktx2",
      "hdr",
      "exr",
      "js",
      "css",
      "xml",
      "webmanifest",
      "txt",
    ];

    for (const extension of rootFileExtensions) {
      expect(doesProxyMatch(`/missing.${extension}`)).toBe(true);
    }

    expect(doesProxyMatch("/MISSING.XML")).toBe(true);
    expect(doesProxyMatch("/llms.txt")).toBe(true);
    expect(doesProxyMatch("/.well-known/llms.txt")).toBe(false);
    expect(doesProxyMatch("/sitemap/base.xml")).toBe(false);
    expect(doesProxyMatch("/llms/en/articles/page/0/llms.txt")).toBe(false);
    expect(doesProxyMatch("/_next/static/chunks/app.js")).toBe(false);
    expect(doesProxyMatch("/models/physics/kinematics/car.svg")).toBe(false);
    expect(
      doesProxyMatch("/models/physics/kinematics/kenney-car-kit/LICENSE.txt")
    ).toBe(false);
    expect(doesProxyMatch("/models/physics/kinematics/car.glb")).toBe(false);
    expect(doesProxyMatch("/missing.png")).toBe(false);
  });

  it("returns a clean 404 for unsupported root files", async () => {
    const paths = [
      "/llms-full.txt",
      "/missing.js",
      "/missing.svg",
      "/missing.webmanifest",
      "/missing.glb",
      "/missing-machine-document.xml",
      "/MISSING-MACHINE-DOCUMENT.XML",
    ];

    for (const path of paths) {
      const response = await proxy(
        new NextRequest(`http://localhost:3000${path}`)
      );

      expect(response.status).toBe(404);
      expect(response.headers.get("content-type")).toBe(
        "text/plain; charset=utf-8"
      );
      expect(response.headers.get("x-robots-tag")).toBe("noindex");
    }

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
  });

  it("delegates regular routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/search")
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(response.headers.get("link")).toBe('</llms.txt>; rel="llms-txt"');
    expect(response.headers.get("x-llms-txt")).toBe("/llms.txt");
  });

  it("rewrites markdown requests through the llms route adapter", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/terms-of-service", {
        headers: {
          accept: "text/markdown",
        },
      })
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/terms-of-service"
    );
  });

  it("lets explicit markdown suffixes reach the llms route adapter", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/quran/1.md")
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/llms.mdx/en/quran/1"
    );
  });

  it("redirects previous material lesson URLs to the canonical architecture", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/id/subject/high-school/11/mathematics/circle/central-angle-and-inscribed-angle?utm=test"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/id/materi/matematika/lingkaran/sudut-pusat-dan-sudut-keliling?utm=test"
    );
  });

  it("returns real 404 responses for invalid finite source-backed HTML routes", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/id/quran/999")
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/id/_not-found"
    );
  });

  it("returns a hard 404 for missing projected HTML routes", async () => {
    runtimeMocks.readPublic.mockReturnValueOnce(Effect.succeed(null));

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/curriculum/merdeka/class-11-afdocs-nonexistent-8f3a"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).not.toHaveBeenCalled();
    expect(response.status).toBe(404);
    expect(response.headers.get("x-middleware-rewrite")).toBe(
      "http://localhost:3000/en/_not-found"
    );
    expect(runtimeMocks.readPublic).toHaveBeenCalledWith({
      locale: "en",
      publicPath: "curriculum/merdeka/class-11-afdocs-nonexistent-8f3a",
    });
  });

  it("delegates unsupported locale paths to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/fr/quran/1")
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates real public content routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/subjects/chemistry/green-chemistry/definition"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(runtimeMocks.readContent).not.toHaveBeenCalled();
    expect(runtimeMocks.readPublic).toHaveBeenCalledWith({
      locale: "en",
      publicPath: "subjects/chemistry/green-chemistry/definition",
    });
  });

  it("delegates curriculum app routes to the locale middleware", async () => {
    runtimeMocks.readPublic.mockReturnValueOnce(
      Effect.succeed({ kind: "curriculum-context", sitemap: true })
    );

    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/id/kurikulum/merdeka/kelas-10/biologi"
      )
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
    expect(runtimeMocks.readContent).not.toHaveBeenCalled();
    expect(runtimeMocks.readPublic).toHaveBeenCalledWith({
      locale: "id",
      publicPath: "kurikulum/merdeka/kelas-10/biologi",
    });
  });

  it("delegates curriculum index routes to the locale middleware", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/id/kurikulum")
    );

    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates non-read content requests without an exact route lookup", async () => {
    const response = await proxy(
      new NextRequest(
        "http://localhost:3000/en/articles/politics/not-a-read-check",
        {
          method: "POST",
        }
      )
    );

    expect(runtimeMocks.readContent).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });

  it("delegates defensive public content roots without an exact route shape", async () => {
    const response = await proxy(
      new NextRequest("http://localhost:3000/en/unknown-content-root/example")
    );

    expect(runtimeMocks.readContent).not.toHaveBeenCalled();
    expect(mockLocaleRouting.localeMiddleware).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-locale-proxy")).toBe("1");
  });
});
