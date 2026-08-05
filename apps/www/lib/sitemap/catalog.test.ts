// @vitest-environment node

import type { Locale } from "@repo/contents/_types/content";
import type { SourceRegistryRoot } from "@repo/contents/_types/graph/schema";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSitemapPageDescriptors } from "@/lib/sitemap/catalog";

const activeMocks = vi.hoisted(() => ({
  readActiveContentIdentity: vi.fn(),
}));
const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentRouteCounts: vi.fn(),
  getRuntimePublicSitemapCount: vi.fn(),
}));
const articleMocks = vi.hoisted(() => ({
  readPublishedArticleBuckets: vi.fn(),
}));
const materialMocks = vi.hoisted(() => ({
  readPublishedMaterialBuckets: vi.fn(),
}));
const programMocks = vi.hoisted(() => ({
  readPublishedProgramBuckets: vi.fn(),
}));
const tryoutMocks = vi.hoisted(() => ({
  readPublishedTryoutSitemapCount: vi.fn(),
}));

vi.mock("@/lib/content/article/sitemap", () => ({
  readPublishedArticleBuckets: articleMocks.readPublishedArticleBuckets,
}));
vi.mock("@/lib/content/material/sitemap", () => ({
  readPublishedMaterialBuckets: materialMocks.readPublishedMaterialBuckets,
}));
vi.mock("@/lib/content/program/sitemap", () => ({
  readPublishedProgramBuckets: programMocks.readPublishedProgramBuckets,
}));
vi.mock("@/lib/content/tryout/sitemap", () => tryoutMocks);

vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: activeMocks.readActiveContentIdentity,
}));

vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRouteCounts: runtimeMocks.getRuntimeContentRouteCounts,
  getRuntimePublicSitemapCount: runtimeMocks.getRuntimePublicSitemapCount,
}));

vi.mock("@repo/internationalization/src/routing", async () => {
  const { defaultLocale, locales } = await import("@repo/utilities/locales");
  return { routing: { defaultLocale, locales } };
});

beforeEach(() => {
  activeMocks.readActiveContentIdentity.mockReset();
  activeMocks.readActiveContentIdentity.mockReturnValue(
    Effect.succeed({ releaseId: "release-material" })
  );
  articleMocks.readPublishedArticleBuckets.mockReset();
  articleMocks.readPublishedArticleBuckets.mockReturnValue(
    Effect.succeed({ articleCount: 0, buckets: [] })
  );
  materialMocks.readPublishedMaterialBuckets.mockReset();
  materialMocks.readPublishedMaterialBuckets.mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-material",
      buckets: [],
      materialCount: 0,
    })
  );
  programMocks.readPublishedProgramBuckets.mockReset();
  programMocks.readPublishedProgramBuckets.mockReturnValue(
    Effect.succeed({ buckets: [], managed: false, routeCount: 0 })
  );
  tryoutMocks.readPublishedTryoutSitemapCount.mockReset();
  tryoutMocks.readPublishedTryoutSitemapCount.mockReturnValue(
    Effect.succeed({ managed: false, pageCount: 0, routeCount: 0 })
  );
  runtimeMocks.getRuntimeContentRouteCounts.mockReset();
  runtimeMocks.getRuntimePublicSitemapCount.mockReset();
  runtimeMocks.getRuntimeContentRouteCounts.mockImplementation(({ locale }) =>
    Effect.succeed(
      locale === "en"
        ? [
            countRow("en", "articles", 1),
            countRow("en", "material", 2),
            countRow("en", "tryout", 2),
          ]
        : [countRow("id", "quran", 101)]
    )
  );
  runtimeMocks.getRuntimePublicSitemapCount.mockReturnValue(
    Effect.succeed({ count: 1, pageCount: 1 })
  );
});

describe("sitemap page catalog", () => {
  it("builds stable descriptors without loading route rows", async () => {
    await expect(
      Effect.runPromise(readSitemapPageDescriptors())
    ).resolves.toEqual([
      { id: "base" },
      { id: "public_en_0", kind: "public", locale: "en", page: 0 },
      {
        id: "content_en_tryout_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "tryout",
      },
      { id: "public_id_0", kind: "public", locale: "id", page: 0 },
      {
        id: "content_id_quran_0",
        kind: "content",
        locale: "id",
        page: 0,
        section: "quran",
      },
    ]);
  });

  it("adds signed article partitions", async () => {
    articleMocks.readPublishedArticleBuckets.mockImplementation((locale) =>
      Effect.succeed({
        articleCount: locale === "en" ? 1 : 0,
        buckets: locale === "en" ? ["abc"] : [],
      })
    );

    const descriptors = await Effect.runPromise(readSitemapPageDescriptors());

    expect(descriptors).toContainEqual({
      bucket: "abc",
      id: "article_en_abc",
      kind: "article",
      locale: "en",
    });
    expect(descriptors).not.toContainEqual(
      expect.objectContaining({
        kind: "content",
        locale: "en",
        section: "articles",
      })
    );
  });

  it("replaces material rows and adds curriculum partitions after cutover", async () => {
    const activeReleaseId = "release-material";
    activeMocks.readActiveContentIdentity.mockReturnValue(
      Effect.succeed({ releaseId: activeReleaseId })
    );
    materialMocks.readPublishedMaterialBuckets.mockImplementation(
      (locale, expectedReleaseId) => {
        expect(expectedReleaseId).toBe(activeReleaseId);
        return Effect.succeed({
          activeReleaseId,
          buckets: locale === "en" ? ["def"] : [],
          materialCount: locale === "en" ? 2 : 0,
        });
      }
    );
    programMocks.readPublishedProgramBuckets.mockImplementation((locale) =>
      Effect.succeed({
        buckets: locale === "en" ? ["abc"] : [],
        managed: locale === "en",
        routeCount: locale === "en" ? 3 : 0,
      })
    );

    const descriptors = await Effect.runPromise(readSitemapPageDescriptors());

    expect(descriptors).toContainEqual({
      bucket: "def",
      id: "material_en_def",
      kind: "material",
      locale: "en",
    });
    expect(descriptors).toContainEqual({
      bucket: "abc",
      id: "program_en_abc",
      kind: "program",
      locale: "en",
    });
    expect(descriptors).not.toContainEqual(
      expect.objectContaining({
        kind: "content",
        locale: "en",
        section: "material",
      })
    );
  });

  it("replaces legacy try-out rows with signed catalog pages", async () => {
    tryoutMocks.readPublishedTryoutSitemapCount.mockImplementation((locale) =>
      Effect.succeed({
        managed: locale === "en",
        pageCount: locale === "en" ? 1 : 0,
        routeCount: locale === "en" ? 48 : 0,
      })
    );

    const descriptors = await Effect.runPromise(readSitemapPageDescriptors());

    expect(descriptors).toContainEqual({
      id: "tryout_en_0",
      kind: "tryout",
      locale: "en",
      page: 0,
    });
    expect(descriptors).not.toContainEqual(
      expect.objectContaining({
        kind: "content",
        locale: "en",
        section: "tryout",
      })
    );
  });

  it("propagates a missing active material publication", async () => {
    activeMocks.readActiveContentIdentity.mockReturnValue(Effect.succeed(null));
    materialMocks.readPublishedMaterialBuckets.mockReturnValue(
      Effect.fail(new Error("Signed material inventory is unavailable."))
    );

    await expect(
      Effect.runPromise(readSitemapPageDescriptors())
    ).rejects.toThrow("Signed material inventory is unavailable.");
  });

  it("rejects descriptors assembled across material releases", async () => {
    activeMocks.readActiveContentIdentity
      .mockReturnValueOnce(Effect.succeed({ releaseId: "release-material" }))
      .mockReturnValueOnce(Effect.succeed({ releaseId: "release-next" }));
    materialMocks.readPublishedMaterialBuckets.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-material",
        buckets: [],
        materialCount: 0,
      })
    );

    await expect(
      Effect.runPromise(readSitemapPageDescriptors().pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedReleaseMismatchError",
      actualReleaseId: "release-next",
      expectedReleaseId: "release-material",
    });
  });

  it("splits counts into bounded XML descriptors", async () => {
    runtimeMocks.getRuntimeContentRouteCounts.mockImplementation(({ locale }) =>
      Effect.succeed(locale === "en" ? [countRow("en", "quran", 1001)] : [])
    );
    runtimeMocks.getRuntimePublicSitemapCount.mockReturnValue(
      Effect.succeed(null)
    );

    await expect(
      Effect.runPromise(readSitemapPageDescriptors())
    ).resolves.toEqual([
      { id: "base" },
      {
        id: "content_en_quran_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "quran",
      },
      {
        id: "content_en_quran_1",
        kind: "content",
        locale: "en",
        page: 1,
        section: "quran",
      },
    ]);
  });
});

/** Builds one route-count fixture row for sitemap catalog tests. */
function countRow(locale: Locale, section: SourceRegistryRoot, count: number) {
  return { count, locale, section, syncedAt: 1 };
}
