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
const materialMocks = vi.hoisted(() => ({
  readPublishedMaterialBuckets: vi.fn(),
  readPublishedMaterialSitemap: vi.fn(),
}));
const programMocks = vi.hoisted(() => ({
  readPublishedProgramBuckets: vi.fn(),
  readPublishedProgramSitemap: vi.fn(),
}));
const tryoutMocks = vi.hoisted(() => ({
  readPublishedTryoutSitemap: vi.fn(),
  readPublishedTryoutSitemapCount: vi.fn(),
}));
const ownershipMocks = vi.hoisted(() => ({
  filterMaterialContentRows: vi.fn(),
  filterMaterialPublicPaths: vi.fn(),
}));
const activeMaterialReleaseId = "release-material";

vi.mock("@/lib/content/article/sitemap", () => ({
  readPublishedArticleSitemap: articleMocks.readPublishedArticleSitemap,
}));
vi.mock("@/lib/content/material/sitemap", () => materialMocks);
vi.mock("@/lib/content/program/sitemap", () => programMocks);
vi.mock("@/lib/content/tryout/sitemap", () => tryoutMocks);
vi.mock("@/lib/sitemap/material", () => ownershipMocks);

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentSitemapPage: runtimeMocks.getRuntimeContentSitemapPage,
  getRuntimePublicSitemapPage: runtimeMocks.getRuntimePublicSitemapPage,
}));

beforeEach(() => {
  ownershipMocks.filterMaterialContentRows
    .mockReset()
    .mockImplementation((_locale, rows) => Effect.succeed(rows));
  ownershipMocks.filterMaterialPublicPaths
    .mockReset()
    .mockImplementation((_locale, paths) => Effect.succeed(paths));
  articleMocks.readPublishedArticleSitemap.mockReset();
  articleMocks.readPublishedArticleSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  materialMocks.readPublishedMaterialBuckets.mockReset();
  materialMocks.readPublishedMaterialBuckets.mockReturnValue(
    Effect.succeed({
      activeReleaseId: null,
      buckets: [],
      managed: false,
      materialCount: 0,
    })
  );
  materialMocks.readPublishedMaterialSitemap.mockReset();
  materialMocks.readPublishedMaterialSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  programMocks.readPublishedProgramBuckets.mockReset();
  programMocks.readPublishedProgramBuckets.mockReturnValue(
    Effect.succeed({ buckets: [], managed: false })
  );
  programMocks.readPublishedProgramSitemap.mockReset();
  programMocks.readPublishedProgramSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  tryoutMocks.readPublishedTryoutSitemap.mockReset();
  tryoutMocks.readPublishedTryoutSitemap.mockReturnValue(Effect.succeed(null));
  tryoutMocks.readPublishedTryoutSitemapCount.mockReset();
  tryoutMocks.readPublishedTryoutSitemapCount.mockReturnValue(
    Effect.succeed({ managed: false, pageCount: 0, routeCount: 0 })
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

  it("serves release-owned material and curriculum sitemap pages", async () => {
    materialMocks.readPublishedMaterialSitemap.mockReturnValue(
      Effect.succeed({
        routes: [
          {
            date: "2026-07-25",
            publicPath: "subjects/mathematics/functions/concept",
          },
          {
            date: "2026-07-24",
            publicPath: "subjects/mathematics/functions/bijection",
          },
        ],
      })
    );
    programMocks.readPublishedProgramSitemap.mockReturnValue(
      Effect.succeed({
        routes: [
          { publicPath: "curriculum/merdeka/class-11/mathematics" },
          { publicPath: "curriculum/merdeka/class-11" },
        ],
      })
    );

    await expect(readPaths("material_en_abc")).resolves.toEqual([
      "/subjects/mathematics/functions/bijection",
      "/subjects/mathematics/functions/concept",
    ]);
    await expect(readPaths("program_en_abc")).resolves.toEqual([
      "/curriculum/merdeka/class-11",
      "/curriculum/merdeka/class-11/mathematics",
    ]);
  });

  it("serves signed try-out routes and rejects their legacy page", async () => {
    tryoutMocks.readPublishedTryoutSitemap.mockReturnValue(
      Effect.succeed({
        paths: ["try-out/indonesia/snbt/2027/set-1", "try-out/indonesia"],
      })
    );
    tryoutMocks.readPublishedTryoutSitemapCount.mockReturnValue(
      Effect.succeed({ managed: true, pageCount: 1, routeCount: 2 })
    );

    await expect(readPaths("tryout_en_0")).resolves.toEqual([
      "/try-out/indonesia",
      "/try-out/indonesia/snbt/2027/set-1",
    ]);
    await expect(readFailure("content_en_tryout_0")).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "content_en_tryout_0",
    });
    expect(runtimeMocks.getRuntimeContentSitemapPage).not.toHaveBeenCalled();
  });

  it("removes source-owned public rows after their family owner activates", async () => {
    runtimeMocks.getRuntimePublicSitemapPage.mockReturnValueOnce(
      Effect.succeed({
        paths: [
          "curriculum/merdeka/class-10/mathematics",
          "subjects/mathematics/functions/concept",
          "try-out/indonesia/snbt",
        ],
        syncedAt: 1_735_689_600_000,
      })
    );
    materialMocks.readPublishedMaterialBuckets.mockReturnValue(
      Effect.succeed({
        activeReleaseId: activeMaterialReleaseId,
        buckets: ["abc"],
        managed: true,
        materialCount: 1,
      })
    );
    programMocks.readPublishedProgramBuckets.mockReturnValue(
      Effect.succeed({ buckets: ["abc"], managed: true })
    );
    tryoutMocks.readPublishedTryoutSitemapCount.mockReturnValue(
      Effect.succeed({ managed: true, pageCount: 1, routeCount: 1 })
    );

    await expect(readPaths("public_en_0")).resolves.toEqual([]);
    expect(ownershipMocks.filterMaterialPublicPaths).toHaveBeenCalledWith(
      "en",
      [
        "curriculum/merdeka/class-10/mathematics",
        "subjects/mathematics/functions/concept",
        "try-out/indonesia/snbt",
      ],
      activeMaterialReleaseId
    );
  });

  it("rejects retained source material pages after family cutover", async () => {
    materialMocks.readPublishedMaterialBuckets.mockReturnValue(
      Effect.succeed({
        activeReleaseId: activeMaterialReleaseId,
        buckets: ["abc"],
        managed: true,
        materialCount: 1,
      })
    );

    await expect(readFailure("content_en_material_0")).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "content_en_material_0",
    });
    expect(runtimeMocks.getRuntimeContentSitemapPage).not.toHaveBeenCalled();
    expect(ownershipMocks.filterMaterialContentRows).not.toHaveBeenCalled();
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
    await expect(readFailure("material_en_abc")).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "material_en_abc",
    });
    await expect(readFailure("program_en_abc")).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "program_en_abc",
    });
    await expect(readFailure("tryout_en_0")).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "tryout_en_0",
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
    sourcePath,
    syncedAt: 1,
  };
}
