// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { MATERIAL_SITEMAP_BUCKET_LIMIT } from "@repo/backend/confect/contentRelease/material/limits";
import { Array as Arr, Effect } from "effect";
import { readFamilyPartition } from "@/lib/sitemap/family";
import { bucketIds } from "@/test/sitemap";

const articleMocks = vi.hoisted(() => ({
  readPublishedArticleBuckets: vi.fn(),
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
const activeMocks = vi.hoisted(() => ({
  expireActiveContentIdentity: vi.fn(),
  loadActiveContentIdentity: vi.fn(),
  readActiveContentIdentity: vi.fn(),
}));

vi.mock("@/lib/content/article/sitemap", () => articleMocks);
vi.mock("@/lib/content/material/sitemap", () => materialMocks);
vi.mock("@/lib/content/program/sitemap", () => programMocks);
vi.mock("@/lib/content/published/active", () => activeMocks);

/** Makes the material bucket inventory serve the given buckets for one release. */
function setMaterialBuckets(
  buckets: string[],
  materialCount: number,
  activeReleaseId = "release-materials"
) {
  materialMocks.readPublishedMaterialBuckets.mockReturnValue(
    Effect.succeed({ activeReleaseId, buckets, materialCount })
  );
}

/** The failure of a partition read whose publication changed between its two pins. */
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
  setMaterialBuckets([], 0);
  materialMocks.readPublishedMaterialSitemap.mockReturnValue(
    Effect.succeed(null)
  );
  programMocks.readPublishedProgramBuckets.mockReturnValue(
    Effect.succeed({ buckets: [], managed: false, routeCount: 0 })
  );
  programMocks.readPublishedProgramSitemap.mockReturnValue(
    Effect.succeed(null)
  );
});

/** Reads the path strings of the first partition of one family. */
const readPaths = Effect.fn("www.sitemap.test.paths")(function* (
  family: "article" | "material" | "program"
) {
  const page = yield* readFamilyPartition(`${family}_en_p0`, family, "en", 0);
  return Arr.map(page.routes, (route) => route.path);
});

/** Reads one typed partition failure. */
function readFailure(
  family: "article" | "material" | "program",
  partition = 0
) {
  return Effect.flip(
    readFamilyPartition(`${family}_en_p${partition}`, family, "en", partition)
  );
}

describe("sitemap family partitions", () => {
  it.effect("serves published article routes in canonical order", () =>
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

      expect(yield* readPaths("article")).toEqual([
        "/articles/politics",
        "/articles/politics/article",
      ]);
      expect(articleMocks.readPublishedArticleSitemap).toHaveBeenCalledWith(
        "en",
        "001"
      );
    })
  );

  it.effect("serves release-owned material and curriculum sitemap pages", () =>
    Effect.gen(function* () {
      setMaterialBuckets(["001"], 2);
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
      programMocks.readPublishedProgramBuckets.mockReturnValue(
        Effect.succeed({
          buckets: ["001"],
          managed: true,
          routeCount: 2,
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

      expect(yield* readPaths("material")).toEqual([
        "/subjects/mathematics/functions/bijection",
        "/subjects/mathematics/functions/concept",
      ]);
      expect(yield* readPaths("program")).toEqual([
        "/curriculum/merdeka/class-11",
        "/curriculum/merdeka/class-11/mathematics",
      ]);
    })
  );

  it.effect(
    "serves capacity-owned material partitions across bucket groups",
    () =>
      Effect.gen(function* () {
        setMaterialBuckets(["002", "001"], 2);
        materialMocks.readPublishedMaterialSitemap.mockImplementation(
          (locale, buckets: string[]) =>
            Effect.succeed({
              routes: Arr.map(buckets, (bucket) => ({
                lastModified: "2026-07-25",
                publicPath: `subjects/mathematics/lesson-${locale}-${bucket}`,
              })),
            })
        );

        expect(yield* readPaths("material")).toEqual([
          "/subjects/mathematics/lesson-en-001",
          "/subjects/mathematics/lesson-en-002",
        ]);
        expect(
          materialMocks.readPublishedMaterialSitemap
        ).toHaveBeenCalledExactlyOnceWith("en", ["001", "002"]);
      })
  );

  it.effect(
    "bounds the number of native queries for a full material partition",
    () =>
      Effect.gen(function* () {
        const buckets = bucketIds(32);
        setMaterialBuckets(buckets, 32, "release-sitemap");
        materialMocks.readPublishedMaterialSitemap.mockImplementation(
          (_locale, batch: string[]) =>
            Effect.succeed({
              routes: Arr.map(batch, (bucket) => ({
                publicPath: `subjects/test/${bucket}`,
              })),
            })
        );
        expect(yield* readPaths("material")).toEqual(
          Arr.map(buckets, (bucket) => `/subjects/test/${bucket}`)
        );
        expect(
          materialMocks.readPublishedMaterialSitemap
        ).toHaveBeenCalledTimes(Math.ceil(32 / MATERIAL_SITEMAP_BUCKET_LIMIT));
        expect(
          Arr.every(
            materialMocks.readPublishedMaterialSitemap.mock.calls,
            ([, batch]) => batch.length <= MATERIAL_SITEMAP_BUCKET_LIMIT
          )
        ).toBe(true);
      })
  );

  it.effect("rejects an empty partition result", () =>
    Effect.gen(function* () {
      setMaterialBuckets(["001"], 1);
      materialMocks.readPublishedMaterialSitemap.mockReturnValue(
        Effect.succeed({ routes: [] })
      );

      expect(yield* readFailure("material")).toMatchObject({
        _tag: "SitemapPageNotFoundError",
        pageId: "material_en_p0",
      });
    })
  );

  it.effect.each([1, MATERIAL_SITEMAP_BUCKET_LIMIT + 1])(
    "rejects a missing singleton tail in a %i-bucket sitemap",
    (length) =>
      Effect.gen(function* () {
        const buckets = bucketIds(length);
        setMaterialBuckets(buckets, buckets.length);
        materialMocks.readPublishedMaterialSitemap.mockImplementation(
          (_locale, batch: string[]) =>
            Effect.succeed(
              batch.length === 1
                ? null
                : {
                    routes: Arr.map(batch, (bucket) => ({
                      publicPath: `subjects/test/${bucket}`,
                    })),
                  }
            )
        );
        expect(yield* readFailure("material")).toMatchObject({
          _tag: "PublishedProjectionError",
        });
      })
  );

  it.effect("rejects partitions rendered across publication releases", () =>
    Effect.gen(function* () {
      setMaterialBuckets(["001"], 1);
      materialMocks.readPublishedMaterialSitemap.mockReturnValue(
        Effect.succeed({
          routes: [
            {
              lastModified: "2026-07-25",
              publicPath: "subjects/mathematics/functions/concept",
            },
          ],
        })
      );
      landRelease();

      expect(yield* readFailure("material")).toMatchObject(releaseMismatch);
      expect(activeMocks.expireActiveContentIdentity).toHaveBeenCalledOnce();
    })
  );

  it.effect(
    "rejects a missing partition read across publication releases, so a just published partition is never cached as missing",
    () =>
      Effect.gen(function* () {
        landRelease();

        expect(yield* readFailure("material", 7)).toMatchObject(
          releaseMismatch
        );

        setMaterialBuckets(["001"], 1);
        materialMocks.readPublishedMaterialSitemap.mockReturnValue(
          Effect.succeed({ routes: [] })
        );
        landRelease();

        expect(yield* readFailure("material")).toMatchObject(releaseMismatch);
      })
  );

  it.effect("rejects partitions without an active publication", () =>
    Effect.gen(function* () {
      activeMocks.readActiveContentIdentity.mockReturnValue(
        Effect.succeed(null)
      );

      expect(yield* readFailure("material")).toMatchObject({
        _tag: "PublishedProjectionError",
        publicPath: "sitemap/material_en_p0.xml",
      });
    })
  );

  it.effect("rejects partitions past the current bucket inventory", () =>
    Effect.gen(function* () {
      expect(yield* readFailure("material", 7)).toMatchObject({
        _tag: "SitemapPageNotFoundError",
        pageId: "material_en_p7",
      });
      expect(yield* readFailure("article")).toMatchObject({
        _tag: "SitemapPageNotFoundError",
        pageId: "article_en_p0",
      });
      expect(yield* readFailure("program")).toMatchObject({
        _tag: "SitemapPageNotFoundError",
        pageId: "program_en_p0",
      });
    })
  );
});
