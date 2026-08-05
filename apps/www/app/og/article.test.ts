// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readArticleOgMetadata } from "@/app/og/article";

const mocks = vi.hoisted(() => ({
  getPublishedArticlePage: vi.fn(),
  getPublishedCategories: vi.fn(),
  getTranslations: vi.fn(),
  readArticleMetadata: vi.fn(),
}));

vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/content",
  () => ({ readArticleMetadata: mocks.readArticleMetadata })
);
vi.mock("@/lib/content/article/catalog", () => ({
  getPublishedArticlePage: mocks.getPublishedArticlePage,
  getPublishedCategories: mocks.getPublishedCategories,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublishedCategories.mockResolvedValue({ categories: [] });
  mocks.getPublishedArticlePage.mockResolvedValue({
    articles: [{ categoryTitle: "Politics" }],
  });
  mocks.getTranslations.mockImplementation(({ namespace }) =>
    Promise.resolve((key: string) => `${namespace}.${key}`)
  );
  mocks.readArticleMetadata.mockResolvedValue({
    metadata: {
      description: "Signed article description",
      title: "Signed article",
    },
  });
});

describe("article OG metadata", () => {
  it("reads the signed article root", async () => {
    await expect(readArticleOgMetadata("en", ["articles"])).resolves.toEqual({
      description: "Articles.description",
      title: "Common.articles",
    });
    expect(mocks.getPublishedCategories).toHaveBeenCalledWith({
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
      locale: "en",
    });
  });

  it("reads a signed category and rejects an empty category", async () => {
    await expect(
      readArticleOgMetadata("en", ["articles", "politics"])
    ).resolves.toEqual({
      description: "Articles.description",
      title: "Politics",
    });
    expect(mocks.getPublishedArticlePage).toHaveBeenCalledWith({
      category: "politics",
      cursor: null,
      expectedManifestHash: null,
      expectedReleaseId: null,
      locale: "en",
    });

    mocks.getPublishedArticlePage.mockResolvedValueOnce({ articles: [] });
    await expect(
      readArticleOgMetadata("id", ["articles", "politics"])
    ).resolves.toBeNull();
  });

  it("reads signed detail metadata and derives a missing description", async () => {
    await expect(
      readArticleOgMetadata("en", ["articles", "politics", "signed-article"])
    ).resolves.toEqual({
      description: "Signed article description",
      title: "Signed article",
    });
    expect(mocks.readArticleMetadata).toHaveBeenCalledWith({
      locale: "en",
      publicPath: "articles/politics/signed-article",
    });

    mocks.readArticleMetadata.mockResolvedValueOnce({
      metadata: { title: "Title fallback" },
    });
    await expect(
      readArticleOgMetadata("id", ["articles", "politics", "title-fallback"])
    ).resolves.toEqual({
      description: "Title fallback",
      title: "Title fallback",
    });
  });

  it("rejects non-article and malformed article paths without catalog reads", async () => {
    const slugs = [
      ["about"],
      ["articles", "Invalid_Category"],
      ["articles", "politics", "Invalid_Slug"],
      ["articles", "politics", "signed-article", "extra"],
    ];

    for (const slug of slugs) {
      await expect(readArticleOgMetadata("en", slug)).resolves.toBeNull();
    }
    expect(mocks.getPublishedArticlePage).not.toHaveBeenCalled();
    expect(mocks.getPublishedCategories).not.toHaveBeenCalled();
    expect(mocks.readArticleMetadata).not.toHaveBeenCalled();
  });
});
