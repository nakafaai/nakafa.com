// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readSitemapRoutePage } from "@/lib/sitemap/routes";

const articleMocks = vi.hoisted(() => ({
  readPublishedArticleSitemap: vi.fn(),
}));
const materialMocks = vi.hoisted(() => ({
  readPublishedMaterialSitemap: vi.fn(),
}));
const pageMocks = vi.hoisted(() => ({
  readPublishedPageCatalog: vi.fn(),
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
vi.mock("@/lib/content/page/catalog", () => pageMocks);
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
  pageMocks.readPublishedPageCatalog.mockReset();
  pageMocks.readPublishedPageCatalog.mockReturnValue(
    Effect.succeed({ activeReleaseId: "release-pages", projections: [] })
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
  it.effect("serves published article routes in canonical order", () =>
    Effect.gen(function* () {
      articleMocks.readPublishedArticleSitemap.mockReturnValue(
        Effect.succeed({
          routes: [
            {
              lastModified: "2026-07-23",
              publicPath: "articles/politics/article",
            },
            { publicPath: "articles/politics" },
          ],
        })
      );

      expect(yield* readPaths("article_en_abc")).toEqual([
        "/articles/politics",
        "/articles/politics/article",
      ]);
      expect(articleMocks.readPublishedArticleSitemap).toHaveBeenCalledWith(
        "en",
        "abc"
      );
    })
  );

  it.effect("serves base and signed Quran route pages", () =>
    Effect.gen(function* () {
      expect(yield* readPaths("base")).toEqual([
        "/",
        "/contributor",
        "/curricula",
        "/pricing",
        "/quran",
        "/search",
      ]);
      expect(yield* readPaths("quran_en")).toEqual(["/quran/1", "/quran/2"]);
    })
  );

  it.effect("serves release-owned material and curriculum sitemap pages", () =>
    Effect.gen(function* () {
      materialMocks.readPublishedMaterialSitemap.mockReturnValue(
        Effect.succeed({
          routes: [
            {
              lastModified: "2026-07-25",
              publicPath: "subjects/mathematics/functions/concept",
            },
            {
              lastModified: "2026-07-24",
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

      expect(yield* readPaths("material_en_abc")).toEqual([
        "/subjects/mathematics/functions/bijection",
        "/subjects/mathematics/functions/concept",
      ]);
      expect(yield* readPaths("program_en_abc")).toEqual([
        "/curriculum/merdeka/class-11",
        "/curriculum/merdeka/class-11/mathematics",
      ]);
    })
  );

  it.effect("serves signed try-out routes", () =>
    Effect.gen(function* () {
      tryoutMocks.readPublishedTryoutSitemap.mockReturnValue(
        Effect.succeed({
          paths: ["try-out/indonesia/snbt/2027/set-1", "try-out/indonesia"],
        })
      );
      expect(yield* readPaths("tryout_en_0")).toEqual([
        "/try-out/indonesia",
        "/try-out/indonesia/snbt/2027/set-1",
      ]);
    })
  );

  it.effect("serves signed Page routes with source-owned dates", () =>
    Effect.gen(function* () {
      pageMocks.readPublishedPageCatalog.mockReturnValue(
        Effect.succeed({
          activeReleaseId: "release-pages",
          projections: [
            pageProjection("de", "impressum", "imprint"),
            pageProjection("en", "legal-notice", "imprint"),
            pageProjection("id", "informasi-perusahaan", "imprint"),
            pageProjection("de", "privacy-policy", "privacy-policy"),
            pageProjection("en", "privacy-policy", "privacy-policy"),
            pageProjection("id", "privacy-policy", "privacy-policy"),
          ],
        })
      );

      const page = yield* readSitemapRoutePage("page_de");

      expect(page.routes).toEqual([
        {
          lastModified: "2026-08-21",
          path: "/impressum",
        },
        {
          lastModified: "2026-08-22",
          path: "/privacy-policy",
        },
      ]);
    })
  );

  it.effect("rejects obsolete source-owned sitemap identities", () =>
    Effect.gen(function* () {
      for (const pageId of [
        "content_en_articles_0",
        "content_en_material_0",
        "content_en_quran_0",
        "content_en_tryout_0",
        "public_en_0",
      ]) {
        expect(yield* readFailure(pageId)).toMatchObject({
          _tag: "SitemapPageNotFoundError",
          pageId,
        });
      }
    })
  );

  it.effect("fails when an id or its materialized page is missing", () =>
    Effect.gen(function* () {
      for (const pageId of [
        "malformed",
        "article_en_abc",
        "material_en_abc",
        "program_en_abc",
        "tryout_en_0",
        "page_en",
      ]) {
        expect(yield* readFailure(pageId)).toMatchObject({
          _tag: "SitemapPageNotFoundError",
          pageId,
        });
      }
    })
  );
});

/** Builds the Page projection fields consumed by sitemap route assembly. */
function pageProjection(
  appLocale: "de" | "en" | "id",
  publicPath: string,
  pageKey: string
) {
  return {
    appLocale,
    metadata:
      pageKey === "imprint"
        ? {
            dateModified: "2026-08-21",
            datePublished: "2026-08-20",
          }
        : { datePublished: "2026-08-22" },
    pageKey,
    publicPath,
  };
}

/** Reads only path strings from one sitemap route page. */
const readPaths = Effect.fn("www.sitemap.test.paths")(function* (
  pageId: string
) {
  const page = yield* readSitemapRoutePage(pageId);
  return page.routes.map((route) => route.path);
});

/** Reads one typed sitemap route failure. */
function readFailure(pageId: string) {
  return Effect.flip(readSitemapRoutePage(pageId));
}
