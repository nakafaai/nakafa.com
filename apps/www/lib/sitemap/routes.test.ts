// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSitemapRoutePage } from "@/lib/sitemap/routes";

const articleMocks = vi.hoisted(() => ({
  readPublishedArticleSitemap: vi.fn(),
}));
const materialMocks = vi.hoisted(() => ({
  readPublishedMaterialSitemap: vi.fn(),
}));
const programMocks = vi.hoisted(() => ({
  readPublishedProgramSitemap: vi.fn(),
}));
const quranMocks = vi.hoisted(() => ({
  readPublishedQuranCatalog: vi.fn(),
}));
const tryoutMocks = vi.hoisted(() => ({
  readPublishedTryoutSitemap: vi.fn(),
}));

vi.mock("@/lib/content/article/sitemap", () => ({
  readPublishedArticleSitemap: articleMocks.readPublishedArticleSitemap,
}));
vi.mock("@/lib/content/material/sitemap", () => materialMocks);
vi.mock("@/lib/content/program/sitemap", () => programMocks);
vi.mock("@/lib/content/quran/publication", () => quranMocks);
vi.mock("@/lib/content/tryout/sitemap", () => tryoutMocks);

beforeEach(() => {
  articleMocks.readPublishedArticleSitemap.mockReset();
  articleMocks.readPublishedArticleSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  materialMocks.readPublishedMaterialSitemap.mockReset();
  materialMocks.readPublishedMaterialSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  programMocks.readPublishedProgramSitemap.mockReset();
  programMocks.readPublishedProgramSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  tryoutMocks.readPublishedTryoutSitemap.mockReset();
  tryoutMocks.readPublishedTryoutSitemap.mockReturnValue(Effect.succeed(null));
  quranMocks.readPublishedQuranCatalog.mockReset();
  quranMocks.readPublishedQuranCatalog.mockReturnValue(
    Effect.succeed({ surahs: [{ number: 1 }, { number: 2 }] })
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

  it("serves base and signed Quran route pages", async () => {
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
    await expect(readPaths("quran_en")).resolves.toEqual([
      "/quran/1",
      "/quran/2",
    ]);
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

  it("serves signed try-out routes", async () => {
    tryoutMocks.readPublishedTryoutSitemap.mockReturnValue(
      Effect.succeed({
        paths: ["try-out/indonesia/snbt/2027/set-1", "try-out/indonesia"],
      })
    );
    await expect(readPaths("tryout_en_0")).resolves.toEqual([
      "/try-out/indonesia",
      "/try-out/indonesia/snbt/2027/set-1",
    ]);
  });

  it("rejects obsolete source-owned sitemap identities", async () => {
    for (const pageId of [
      "content_en_articles_0",
      "content_en_material_0",
      "content_en_quran_0",
      "content_en_tryout_0",
      "public_en_0",
    ]) {
      await expect(readFailure(pageId)).resolves.toMatchObject({
        _tag: "SitemapPageNotFoundError",
        pageId,
      });
    }
  });

  it("fails when an id or its materialized page is missing", async () => {
    await expect(readFailure("malformed")).resolves.toMatchObject({
      _tag: "SitemapPageNotFoundError",
      pageId: "malformed",
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
