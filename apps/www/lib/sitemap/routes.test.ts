// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Array as Arr, Effect } from "effect";
import { readSitemapRoutePage } from "@/lib/sitemap/routes";
import { pageProjection } from "@/test/sitemap";

const articleMocks = vi.hoisted(() => ({
  readPublishedArticleBuckets: vi.fn(),
  readPublishedArticleSitemap: vi.fn(),
}));
const materialMocks = vi.hoisted(() => ({
  readPublishedMaterialBuckets: vi.fn(),
  readPublishedMaterialSitemap: vi.fn(),
}));
const pageMocks = vi.hoisted(() => ({
  readPublishedPageCatalog: vi.fn(),
}));
const programMocks = vi.hoisted(() => ({
  readPublishedProgramBuckets: vi.fn(),
  readPublishedProgramSitemap: vi.fn(),
}));
const quranMocks = vi.hoisted(() => ({
  readPublishedQuranCatalog: vi.fn(),
}));
const tryoutMocks = vi.hoisted(() => ({
  readPublishedTryoutSitemap: vi.fn(),
  readPublishedTryoutSitemapCount: vi.fn(),
}));
const activeMocks = vi.hoisted(() => ({
  expireActiveContentIdentity: vi.fn(),
  loadActiveContentIdentity: vi.fn(),
  readActiveContentIdentity: vi.fn(),
}));

vi.mock("@/lib/content/article/sitemap", () => articleMocks);
vi.mock("@/lib/content/material/sitemap", () => materialMocks);
vi.mock("@/lib/content/page/catalog", () => pageMocks);
vi.mock("@/lib/content/program/sitemap", () => programMocks);
vi.mock("@/lib/content/quran/publication", () => quranMocks);
vi.mock("@/lib/content/tryout/sitemap", () => tryoutMocks);
vi.mock("@/lib/content/published/active", () => activeMocks);

/** Makes the readers behind one non-partition sitemap page answer with routes. */
function serveFoundPage(pageId: string) {
  if (pageId === "tryout_en_0") {
    tryoutMocks.readPublishedTryoutSitemap.mockReturnValue(
      Effect.succeed({ paths: ["try-out/indonesia"] })
    );
  }
  if (pageId === "page_en") {
    pageMocks.readPublishedPageCatalog.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-pages",
        projections: [pageProjection("en", "legal-notice", "imprint")],
      })
    );
  }
}

/** The failure of a page read whose publication changed between its two pins. */
const releaseMismatch = {
  _tag: "PublishedReleaseMismatchError",
  actualReleaseId: "release-after",
  expectedReleaseId: "release-before",
};

/** Makes the stored pointer and Convex name different releases for one read. */
function landRelease() {
  activeMocks.readActiveContentIdentity.mockReturnValueOnce(
    Effect.succeed({ releaseId: "release-before" })
  );
  activeMocks.loadActiveContentIdentity.mockReturnValueOnce(
    Effect.succeed({ releaseId: "release-after" })
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  activeMocks.expireActiveContentIdentity.mockReturnValue(Effect.void);
  activeMocks.readActiveContentIdentity.mockReturnValue(
    Effect.succeed({ releaseId: "release-sitemap" })
  );
  activeMocks.loadActiveContentIdentity.mockReturnValue(
    Effect.succeed({ releaseId: "release-sitemap" })
  );
  articleMocks.readPublishedArticleBuckets.mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-articles",
      articleCount: 0,
      buckets: [],
    })
  );
  articleMocks.readPublishedArticleSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  materialMocks.readPublishedMaterialBuckets.mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-materials",
      buckets: [],
      materialCount: 0,
    })
  );
  materialMocks.readPublishedMaterialSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  pageMocks.readPublishedPageCatalog.mockReturnValue(
    Effect.succeed({ activeReleaseId: "release-pages", projections: [] })
  );
  programMocks.readPublishedProgramBuckets.mockReturnValue(
    Effect.succeed({ buckets: [], managed: false, routeCount: 0 })
  );
  programMocks.readPublishedProgramSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  tryoutMocks.readPublishedTryoutSitemap.mockReturnValue(Effect.succeed(null));
  tryoutMocks.readPublishedTryoutSitemapCount.mockReturnValue(
    Effect.succeed({ pageCount: 1, routeCount: 0 })
  );
  quranMocks.readPublishedQuranCatalog.mockReturnValue(
    Effect.succeed({ surahs: [{ number: 1 }, { number: 2 }] })
  );
});

describe("sitemap route pages", () => {
  it.effect("serves a family partition through its bucket inventory", () =>
    Effect.gen(function* () {
      articleMocks.readPublishedArticleBuckets.mockReturnValue(
        Effect.succeed({
          activeReleaseId: "release-articles",
          articleCount: 2,
          buckets: ["001"],
        })
      );
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

      expect(yield* readPaths("article_en_p0")).toEqual([
        "/articles/politics",
        "/articles/politics/article",
      ]);
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

  it.effect("rejects retired hash-bucket page ids without reading Convex", () =>
    Effect.gen(function* () {
      for (const pageId of [
        "article_en_abc",
        "material_en_def",
        "program_id_012",
      ]) {
        expect(yield* readFailure(pageId)).toMatchObject({
          _tag: "SitemapPageNotFoundError",
          pageId,
        });
      }
      expect(materialMocks.readPublishedMaterialBuckets).not.toHaveBeenCalled();
      expect(articleMocks.readPublishedArticleBuckets).not.toHaveBeenCalled();
      expect(programMocks.readPublishedProgramBuckets).not.toHaveBeenCalled();
    })
  );

  it.effect.each(["tryout_en_0", "page_en"])(
    "rejects a missing %s read across publication releases",
    (pageId) =>
      Effect.gen(function* () {
        landRelease();

        expect(yield* readFailure(pageId)).toMatchObject(releaseMismatch);
      })
  );

  it.effect.each(["tryout_en_0", "page_en", "quran_en"])(
    "rejects a found %s sitemap rendered across publication releases, so a stale pointer never reaches the long origin cache",
    (pageId) =>
      Effect.gen(function* () {
        serveFoundPage(pageId);
        landRelease();

        expect(yield* readFailure(pageId)).toMatchObject(releaseMismatch);
        expect(activeMocks.expireActiveContentIdentity).toHaveBeenCalledOnce();
      })
  );

  it.effect("never reads a try-out page beyond the count of its release", () =>
    Effect.gen(function* () {
      tryoutMocks.readPublishedTryoutSitemapCount.mockReturnValue(
        Effect.succeed({ pageCount: 1, routeCount: 5 })
      );

      expect(yield* readFailure("tryout_en_999999")).toMatchObject({
        _tag: "SitemapPageNotFoundError",
        pageId: "tryout_en_999999",
      });
      expect(tryoutMocks.readPublishedTryoutSitemap).not.toHaveBeenCalled();
    })
  );

  it.effect("rejects a page beyond the count across publication releases", () =>
    Effect.gen(function* () {
      landRelease();

      expect(yield* readFailure("tryout_en_999999")).toMatchObject(
        releaseMismatch
      );
      expect(tryoutMocks.readPublishedTryoutSitemap).not.toHaveBeenCalled();
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

/** Reads only path strings from one sitemap route page. */
const readPaths = Effect.fn("www.sitemap.test.paths")(function* (
  pageId: string
) {
  const page = yield* readSitemapRoutePage(pageId);
  return Arr.map(page.routes, (route) => route.path);
});

/** Reads one typed sitemap route failure. */
function readFailure(pageId: string) {
  return Effect.flip(readSitemapRoutePage(pageId));
}
