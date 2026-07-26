// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readPublishedArticleCategory } from "@/lib/content/article/ownership";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/runtime/query", async () => {
  const { readTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    fetchRuntimeQuery: fetchMock,
    readRuntimeQuery: readTestRuntimeQuery,
  };
});

describe("published article category ownership", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("reads one exact localized category", async () => {
    fetchMock.mockResolvedValueOnce({ exists: true, managed: true });

    await expect(
      Effect.runPromise(readPublishedArticleCategory("politics", "en"))
    ).resolves.toEqual({ exists: true, managed: true });
    expect(fetchMock).toHaveBeenCalledWith(expect.anything(), {
      category: "politics",
      locale: "en",
    });
  });

  it("preserves runtime query failures in the Effect error channel", async () => {
    fetchMock.mockRejectedValueOnce(new Error("category unavailable"));

    await expect(
      Effect.runPromise(readPublishedArticleCategory("politics", "id"))
    ).rejects.toThrow("category unavailable");
  });
});
