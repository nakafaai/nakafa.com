// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hasPublishedArticleCategory } from "@/lib/content/article/category";

const runtimeQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

describe("published article category", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
  });

  it("reads one exact localized category", async () => {
    runtimeQueryMock.mockResolvedValueOnce({ exists: true, managed: true });

    await expect(
      Effect.runPromise(hasPublishedArticleCategory("politics", "en"))
    ).resolves.toBe(true);
    expect(runtimeQueryMock).toHaveBeenCalledWith(expect.anything(), {
      category: "politics",
      locale: "en",
    });
  });

  it("rejects an unmanaged article catalog", async () => {
    runtimeQueryMock.mockResolvedValueOnce({ exists: false, managed: false });

    await expect(
      Effect.runPromise(
        hasPublishedArticleCategory("politics", "en").pipe(Effect.flip)
      )
    ).resolves.toMatchObject({
      _tag: "PublishedProjectionError",
      locale: "en",
      publicPath: "articles/politics",
    });
  });

  it("preserves runtime query failures in the Effect error channel", async () => {
    runtimeQueryMock.mockRejectedValueOnce(new Error("category unavailable"));

    await expect(
      Effect.runPromise(hasPublishedArticleCategory("politics", "id"))
    ).rejects.toThrow("category unavailable");
  });
});
