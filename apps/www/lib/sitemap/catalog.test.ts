// @vitest-environment node

import { Effect, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSitemapPageDescriptors } from "@/lib/sitemap/catalog";

class MissingSignedMaterialInventory extends Schema.TaggedError<MissingSignedMaterialInventory>()(
  "MissingSignedMaterialInventory",
  { message: Schema.String }
) {}

const activeMocks = vi.hoisted(() => ({
  readActiveContentIdentity: vi.fn(),
}));
const articleMocks = vi.hoisted(() => ({
  readPublishedArticleBuckets: vi.fn(),
}));
const materialMocks = vi.hoisted(() => ({
  readPublishedMaterialBuckets: vi.fn(),
}));
const pageMocks = vi.hoisted(() => ({
  readPublishedPageCatalog: vi.fn(),
}));
const programMocks = vi.hoisted(() => ({
  readPublishedProgramBuckets: vi.fn(),
}));
const quranMocks = vi.hoisted(() => ({
  readPublishedQuranCatalog: vi.fn(),
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
vi.mock("@/lib/content/page/catalog", () => ({
  readPublishedPageCatalog: pageMocks.readPublishedPageCatalog,
}));
vi.mock("@/lib/content/program/sitemap", () => ({
  readPublishedProgramBuckets: programMocks.readPublishedProgramBuckets,
}));
vi.mock("@/lib/content/quran/publication", () => quranMocks);
vi.mock("@/lib/content/tryout/sitemap", () => tryoutMocks);

vi.mock("@/lib/content/published/active", () => ({
  readActiveContentIdentity: activeMocks.readActiveContentIdentity,
}));

vi.mock("@repo/internationalization/src/routing", async () => {
  const { ACTIVE_APP_LOCALE_CODES } = await import(
    "@nakafa/aksara-contracts/locale"
  );
  return {
    routing: {
      defaultLocale: ACTIVE_APP_LOCALE_CODES[0],
      locales: ACTIVE_APP_LOCALE_CODES,
    },
  };
});

beforeEach(() => {
  activeMocks.readActiveContentIdentity.mockReset();
  activeMocks.readActiveContentIdentity.mockReturnValue(
    Effect.succeed({ releaseId: "release-material" })
  );
  articleMocks.readPublishedArticleBuckets.mockReset();
  articleMocks.readPublishedArticleBuckets.mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-material",
      articleCount: 0,
      buckets: [],
    })
  );
  materialMocks.readPublishedMaterialBuckets.mockReset();
  materialMocks.readPublishedMaterialBuckets.mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-material",
      buckets: [],
      materialCount: 0,
    })
  );
  pageMocks.readPublishedPageCatalog.mockReset();
  pageMocks.readPublishedPageCatalog.mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-material",
      projections: [
        { appLocale: "en" },
        { appLocale: "id" },
        { appLocale: "de" },
      ],
    })
  );
  programMocks.readPublishedProgramBuckets.mockReset();
  programMocks.readPublishedProgramBuckets.mockReturnValue(
    Effect.succeed({ buckets: [], managed: false, routeCount: 0 })
  );
  quranMocks.readPublishedQuranCatalog.mockReset();
  quranMocks.readPublishedQuranCatalog.mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-material",
      surahs: [{ number: 1 }],
    })
  );
  tryoutMocks.readPublishedTryoutSitemapCount.mockReset();
  tryoutMocks.readPublishedTryoutSitemapCount.mockReturnValue(
    Effect.succeed({ pageCount: 0, routeCount: 0 })
  );
});

describe("sitemap page catalog", () => {
  it("builds stable descriptors without loading route rows", async () => {
    await expect(
      Effect.runPromise(readSitemapPageDescriptors())
    ).resolves.toEqual([
      { id: "base" },
      { id: "quran_en", kind: "quran", locale: "en" },
      { id: "page_en", kind: "page", locale: "en" },
      { id: "quran_id", kind: "quran", locale: "id" },
      { id: "page_id", kind: "page", locale: "id" },
      { id: "quran_de", kind: "quran", locale: "de" },
      { id: "page_de", kind: "page", locale: "de" },
    ]);
  });

  it("adds signed article partitions", async () => {
    articleMocks.readPublishedArticleBuckets.mockImplementation(
      (locale, expectedReleaseId) => {
        expect(expectedReleaseId).toBe("release-material");
        return Effect.succeed({
          activeReleaseId: "release-material",
          articleCount: locale === "en" ? 1 : 0,
          buckets: locale === "en" ? ["abc"] : [],
        });
      }
    );

    const descriptors = await Effect.runPromise(readSitemapPageDescriptors());

    expect(descriptors).toContainEqual({
      bucket: "abc",
      id: "article_en_abc",
      kind: "article",
      locale: "en",
    });
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
  });

  it("replaces legacy try-out rows with signed catalog pages", async () => {
    tryoutMocks.readPublishedTryoutSitemapCount.mockImplementation((locale) =>
      Effect.succeed({
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
  });

  it("propagates a missing signed material inventory", async () => {
    materialMocks.readPublishedMaterialBuckets.mockReturnValue(
      Effect.fail(
        new MissingSignedMaterialInventory({
          message: "Signed material inventory is unavailable.",
        })
      )
    );

    await expect(
      Effect.runPromise(readSitemapPageDescriptors())
    ).rejects.toThrow("Signed material inventory is unavailable.");
  });

  it("rejects a missing active publication before reading families", async () => {
    activeMocks.readActiveContentIdentity.mockReturnValue(Effect.succeed(null));

    await expect(
      Effect.runPromise(readSitemapPageDescriptors().pipe(Effect.flip))
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      appLocale: "en",
      publicPath: "sitemap.xml",
    });
    expect(quranMocks.readPublishedQuranCatalog).not.toHaveBeenCalled();
  });

  it("rejects descriptors assembled across publication releases", async () => {
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

  it("rejects a Quran catalog from another active release", async () => {
    quranMocks.readPublishedQuranCatalog.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-next",
        surahs: [{ number: 1 }],
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

  it("omits Quran pages when the signed catalog is empty", async () => {
    pageMocks.readPublishedPageCatalog.mockReturnValue(
      Effect.succeed({
        activeReleaseId: "release-material",
        projections: [],
      })
    );
    quranMocks.readPublishedQuranCatalog.mockReturnValue(
      Effect.succeed({ activeReleaseId: "release-material", surahs: [] })
    );

    await expect(
      Effect.runPromise(readSitemapPageDescriptors())
    ).resolves.toEqual([{ id: "base" }]);
  });
});
