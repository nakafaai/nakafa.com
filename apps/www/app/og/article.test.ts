// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { readArticleOgMetadata } from "@/app/og/article";

const mocks = vi.hoisted(() => ({
  getArticleModel: vi.fn(),
  getPublishedArticleCategory: vi.fn(),
  getPublishedCategories: vi.fn(),
  getTranslations: vi.fn(),
  resolveArticleOwner: vi.fn(),
}));

vi.mock(
  "@/app/[locale]/(app)/(shared)/(main)/(learn)/articles/[category]/[slug]/owner",
  () => ({ resolveArticleOwner: mocks.resolveArticleOwner })
);
vi.mock("@/lib/content/article/catalog", () => ({
  getPublishedCategories: mocks.getPublishedCategories,
}));
vi.mock("@/lib/content/article/category", () => ({
  getPublishedArticleCategory: mocks.getPublishedArticleCategory,
}));
vi.mock("@/lib/content/article/publication", () => ({
  getArticleModel: mocks.getArticleModel,
}));
vi.mock("next-intl/server", () => ({
  getTranslations: mocks.getTranslations,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublishedCategories.mockResolvedValue({ categories: [] });
  mocks.getPublishedArticleCategory.mockResolvedValue({
    category: "politics",
    route: "politik",
    title: "Politik",
  });
  mocks.getTranslations.mockImplementation(({ namespace }) =>
    Promise.resolve((key: string) => `${namespace}.${key}`)
  );
  mocks.resolveArticleOwner.mockResolvedValue({ kind: "published" });
  mocks.getArticleModel.mockResolvedValue({
    model: {
      projection: {
        metadata: {
          description: "Signed article description",
          title: "Signed article",
        },
      },
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

  it("reads a signed localized category and rejects an absent category", async () => {
    await expect(
      readArticleOgMetadata("de", ["articles", "politik"])
    ).resolves.toEqual({
      description: "Articles.description",
      title: "Politik",
    });

    mocks.getPublishedArticleCategory.mockResolvedValueOnce(null);
    await expect(
      readArticleOgMetadata("de", ["articles", "fehlend"])
    ).resolves.toBeNull();
  });

  it("reads signed detail metadata without rendering the body", async () => {
    await expect(
      readArticleOgMetadata("en", ["articles", "politics", "signed-article"])
    ).resolves.toEqual({
      description: "Signed article description",
      title: "Signed article",
    });
    expect(mocks.resolveArticleOwner).toHaveBeenCalledWith({
      locale: "en",
      publicPath: "articles/politics/signed-article",
    });
    expect(mocks.getArticleModel).toHaveBeenCalledWith(
      "en",
      "articles/politics/signed-article"
    );

    mocks.getArticleModel.mockResolvedValueOnce({
      model: { projection: { metadata: { title: "Title fallback" } } },
    });
    await expect(
      readArticleOgMetadata("id", ["articles", "politics", "title-fallback"])
    ).resolves.toEqual({
      description: "Title fallback",
      title: "Title fallback",
    });
  });

  it("reads preview detail metadata without touching the published model", async () => {
    mocks.resolveArticleOwner.mockResolvedValueOnce({
      content: {
        metadata: {
          description: "Preview description",
          title: "Preview title",
        },
      },
      kind: "preview",
    });

    await expect(
      readArticleOgMetadata("en", ["articles", "politics", "preview-article"])
    ).resolves.toEqual({
      description: "Preview description",
      title: "Preview title",
    });
    expect(mocks.getArticleModel).not.toHaveBeenCalled();
  });

  it("derives a missing preview description from its title", async () => {
    mocks.resolveArticleOwner.mockResolvedValueOnce({
      content: { metadata: { title: "Preview title" } },
      kind: "preview",
    });

    await expect(
      readArticleOgMetadata("en", ["articles", "politics", "preview-article"])
    ).resolves.toEqual({
      description: "Preview title",
      title: "Preview title",
    });
  });

  it("returns null when the signed article release is withdrawn", async () => {
    mocks.getArticleModel.mockResolvedValueOnce(null);

    await expect(
      readArticleOgMetadata("en", ["articles", "politics", "withdrawn"])
    ).resolves.toBeNull();
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
    expect(mocks.getPublishedArticleCategory).not.toHaveBeenCalled();
    expect(mocks.getPublishedCategories).not.toHaveBeenCalled();
    expect(mocks.getArticleModel).not.toHaveBeenCalled();
    expect(mocks.resolveArticleOwner).not.toHaveBeenCalled();
  });
});
