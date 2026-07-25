// @vitest-environment node

import type { api } from "@repo/backend/convex/_generated/api";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import type { SourceRegistryRoot } from "@repo/contents/_types/graph/schema";
import type { FunctionReturnType } from "convex/server";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSitemapRoutePage } from "@/lib/sitemap/routes";

type RuntimeContentRoute = NonNullable<
  FunctionReturnType<typeof api.contents.queries.runtime.getContentSitemapPage>
>["routes"][number];

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentSitemapPage: vi.fn(),
  getRuntimePublicSitemapPage: vi.fn(),
}));
const articleMocks = vi.hoisted(() => ({
  readPublishedArticleSitemap: vi.fn(),
}));

vi.mock("@/lib/content/article/sitemap", () => ({
  readPublishedArticleSitemap: articleMocks.readPublishedArticleSitemap,
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentSitemapPage: runtimeMocks.getRuntimeContentSitemapPage,
  getRuntimePublicSitemapPage: runtimeMocks.getRuntimePublicSitemapPage,
}));

vi.mock("@repo/internationalization/src/routing", async () => {
  const { defaultLocale, locales } = await import("@repo/utilities/locales");
  return { routing: { defaultLocale, locales } };
});

beforeEach(() => {
  articleMocks.readPublishedArticleSitemap.mockReset();
  articleMocks.readPublishedArticleSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  runtimeMocks.getRuntimeContentSitemapPage.mockReset();
  runtimeMocks.getRuntimePublicSitemapPage.mockReset();
  runtimeMocks.getRuntimeContentSitemapPage.mockImplementation(({ section }) =>
    Effect.succeed({
      routes: routeRows.filter((route) => route.section === section),
    })
  );
  runtimeMocks.getRuntimePublicSitemapPage.mockImplementation(({ locale }) =>
    Effect.succeed({
      paths:
        locale === "en"
          ? ["curriculum/merdeka/class-10/mathematics"]
          : ["kurikulum/merdeka/kelas-10/matematika"],
      syncedAt: 1_735_689_600_000,
    })
  );
});

describe("sitemap route pages", () => {
  it("serves published article routes in canonical order", async () => {
    articleMocks.readPublishedArticleSitemap.mockReturnValue(
      Effect.succeed({
        routes: [
          {
            date: "2026-07-23",
            publicPath: "articles/politics/article",
          },
          { date: null, publicPath: "articles/politics" },
        ],
      })
    );

    await expect(readPaths("article_en_abc")).resolves.toEqual([
      "/articles/politics",
      "/articles/politics/article",
    ]);
    expect(articleMocks.readPublishedArticleSitemap).toHaveBeenCalledWith(
      "en",
      "abc"
    );
  });

  it("serves base, content, and public route pages", async () => {
    await expect(readPaths("base")).resolves.toEqual([
      "/",
      "/contributor",
      "/curricula",
      "/privacy-policy",
      "/quran",
      "/search",
      "/security-policy",
      "/terms-of-service",
    ]);
    await expect(readPaths("content_en_material_0")).resolves.toEqual([
      "/subjects/chemistry/green-chemistry/definition",
    ]);
    expect(runtimeMocks.getRuntimeContentSitemapPage).toHaveBeenCalledWith({
      locale: "en",
      page: 0,
      section: "material",
    });
    await expect(readPaths("content_en_tryout_0")).resolves.toEqual([
      "/try-out/indonesia/snbt/2027/set-1",
      "/try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
    ]);
    await expect(
      Effect.runPromise(readSitemapRoutePage("public_en_0"))
    ).resolves.toEqual({
      routes: [
        {
          lastModified: 1_735_689_600_000,
          path: "/curriculum/merdeka/class-10/mathematics",
        },
      ],
    });
  });

  it("fails when an id or its materialized page is missing", async () => {
    await expect(readFailure("malformed")).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "malformed",
    });
    runtimeMocks.getRuntimeContentSitemapPage.mockReturnValueOnce(
      Effect.succeed(null)
    );
    await expect(readFailure("content_en_material_0")).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "content_en_material_0",
    });
    runtimeMocks.getRuntimePublicSitemapPage.mockReturnValueOnce(
      Effect.succeed(null)
    );
    await expect(readFailure("public_en_0")).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "public_en_0",
    });
    await expect(readFailure("article_en_abc")).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "article_en_abc",
    });
  });
});

/** Reads only path strings from one sitemap route page. */
async function readPaths(pageId: string) {
  const page = await Effect.runPromise(readSitemapRoutePage(pageId));
  return page.routes.map((route) => route.path);
}

/** Reads one typed sitemap route failure. */
function readFailure(pageId: string) {
  return Effect.runPromise(Effect.flip(readSitemapRoutePage(pageId)));
}

const routeRows = [
  routeRow({
    locale: "en",
    route: "subjects/chemistry/green-chemistry/definition",
    section: "material",
    sourcePath: "material/lesson/chemistry/green-chemistry/definition",
  }),
  routeRow({
    locale: "en",
    route: "try-out/indonesia/snbt/2027/set-1",
    section: "tryout",
  }),
  routeRow({
    locale: "en",
    route: "try-out/indonesia/snbt/2027/set-1/quantitative-knowledge",
    section: "tryout",
  }),
];

/** Builds one route-catalog fixture row for sitemap tests. */
function routeRow({
  locale,
  route,
  section,
  sourcePath = route,
}: {
  locale: "en";
  route: string;
  section: SourceRegistryRoot;
  sourcePath?: string;
}): RuntimeContentRoute {
  const kind = getSourceRouteProjectionForRoute(sourcePath, locale)?.kind;
  if (!kind) {
    throw new Error(`Expected graph route kind for ${sourcePath}.`);
  }
  return {
    date: 1_735_689_600_000,
    kind,
    route,
    section,
    syncedAt: 1,
  };
}
