import { ModuleLoadError } from "@repo/contents/_shared/error";
import { Effect } from "effect";
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

  it("reports the article reference module path when import fails", async () => {
    getArticleReferences("articles/politics/test-article");

    const loader = mockGetScopedReferences.mock.calls[0]?.[1];

    if (typeof loader !== "function") {
      throw new Error("Expected article references loader to be registered.");
    }

    const error = await Effect.runPromise(
      Effect.flip(loader("politics/test-article"))
    );

    expect(error).toBeInstanceOf(ModuleLoadError);
    expect(error).toMatchObject({
      message: "Unable to import article references.",
      path: "@repo/contents/articles/politics/test-article/ref.ts",
    });
  });
});
