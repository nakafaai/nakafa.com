import { afterEach, describe, expect, it, vi } from "vitest";

const { mockGetScopedReferences } = vi.hoisted(() => ({
  mockGetScopedReferences: vi.fn(),
}));

vi.mock("@repo/contents/_lib/scoped", () => ({
  getScopedReferences: mockGetScopedReferences,
}));

import { getArticleReferences } from "@repo/contents/_lib/articles/references";

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
