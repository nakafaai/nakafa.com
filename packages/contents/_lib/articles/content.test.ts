import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGetScopedContent, mockGetScopedContents, mockGetScopedReferences } =
  vi.hoisted(() => ({
    mockGetScopedContent: vi.fn(),
    mockGetScopedContents: vi.fn(),
    mockGetScopedReferences: vi.fn(),
  }));

vi.mock("@repo/contents/_lib/scoped", () => ({
  getScopedContent: mockGetScopedContent,
  getScopedContents: mockGetScopedContents,
  getScopedReferences: mockGetScopedReferences,
}));

import {
  getArticleContent,
  getArticleContents,
  getArticleReferences,
} from "@repo/contents/_lib/articles/content";

describe("getArticleContent", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates article content loading with explicit options", () => {
    getArticleContent("en", "articles/politics/test-article", {
      includeMDX: false,
    });

    expect(mockGetScopedContent).toHaveBeenCalledWith(
      "articles",
      "en",
      "articles/politics/test-article",
      { includeMDX: false }
    );
  });

  it("delegates article content loading with default options", () => {
    getArticleContent("en", "articles/politics/test-article");

    expect(mockGetScopedContent).toHaveBeenCalledWith(
      "articles",
      "en",
      "articles/politics/test-article",
      {}
    );
  });
});

describe("getArticleContents", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates article list loading with explicit options", () => {
    getArticleContents({
      basePath: "articles/politics",
      includeMDX: false,
      locale: "en",
    });

    expect(mockGetScopedContents).toHaveBeenCalledWith("articles", {
      basePath: "articles/politics",
      includeMDX: false,
      locale: "en",
    });
  });

  it("delegates article list loading with default options", () => {
    getArticleContents();

    expect(mockGetScopedContents).toHaveBeenCalledWith("articles", {});
  });
});

describe("getArticleReferences", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("delegates article references loading", () => {
    getArticleReferences("articles/politics/test-article");

    expect(mockGetScopedReferences).toHaveBeenCalledWith(
      "articles",
      expect.any(Function),
      "articles/politics/test-article"
    );
  });
});
