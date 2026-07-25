// @vitest-environment node

import type { Locale } from "@repo/contents/_types/content";
import type { SourceRegistryRoot } from "@repo/contents/_types/graph/schema";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSitemapPageDescriptors } from "@/lib/sitemap/catalog";

const runtimeMocks = vi.hoisted(() => ({
  getRuntimeContentRouteCounts: vi.fn(),
  getRuntimePublicSitemapCount: vi.fn(),
}));
const articleMocks = vi.hoisted(() => ({
  readPublishedArticleBuckets: vi.fn(),
}));

vi.mock("@/lib/content/article/sitemap", () => ({
  readPublishedArticleBuckets: articleMocks.readPublishedArticleBuckets,
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
  articleMocks.readPublishedArticleBuckets.mockReset();
  articleMocks.readPublishedArticleBuckets.mockReturnValue(
    Effect.succeed({ articleCount: 0, buckets: [], managed: false })
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
        id: "content_en_articles_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "articles",
      },
      {
        id: "content_en_material_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "material",
      },
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

  it("replaces source-backed article pages with published partitions", async () => {
    articleMocks.readPublishedArticleBuckets.mockImplementation((locale) =>
      Effect.succeed({
        articleCount: locale === "en" ? 1 : 0,
        buckets: locale === "en" ? ["abc"] : [],
        managed: locale === "en",
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

  it("splits counts into bounded XML descriptors", async () => {
    runtimeMocks.getRuntimeContentRouteCounts.mockImplementation(({ locale }) =>
      Effect.succeed(locale === "en" ? [countRow("en", "material", 1001)] : [])
    );
    runtimeMocks.getRuntimePublicSitemapCount.mockReturnValue(
      Effect.succeed(null)
    );

    await expect(
      Effect.runPromise(readSitemapPageDescriptors())
    ).resolves.toEqual([
      { id: "base" },
      {
        id: "content_en_material_0",
        kind: "content",
        locale: "en",
        page: 0,
        section: "material",
      },
      {
        id: "content_en_material_1",
        kind: "content",
        locale: "en",
        page: 1,
        section: "material",
      },
    ]);
  });
});

/** Builds one route-count fixture row for sitemap catalog tests. */
function countRow(locale: Locale, section: SourceRegistryRoot, count: number) {
  return { count, locale, section, syncedAt: 1 };
}
