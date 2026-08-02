// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPublishedTryoutSitemap,
  readPublishedTryoutSitemapCount,
} from "@/lib/content/tryout/sitemap";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/query", async () => {
  const { readTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    fetchRuntimeQuery: fetchMock,
    readRuntimeQuery: readTestRuntimeQuery,
  };
});

describe("published try-out sitemap", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("reads route inventory and one exact bounded page", async () => {
    fetchMock
      .mockResolvedValueOnce({ managed: true, pageCount: 1, routeCount: 2 })
      .mockResolvedValueOnce({ paths: ["try-out/alpha", "try-out/zeta"] });

    await expect(
      Effect.runPromise(readPublishedTryoutSitemapCount("en"))
    ).resolves.toEqual({ managed: true, pageCount: 1, routeCount: 2 });
    await expect(
      Effect.runPromise(readPublishedTryoutSitemap("en", 0))
    ).resolves.toEqual({ paths: ["try-out/alpha", "try-out/zeta"] });
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.anything(), {
      locale: "en",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.anything(), {
      locale: "en",
      page: 0,
    });
  });

  it("preserves runtime query failures in the Effect error channel", async () => {
    fetchMock.mockRejectedValueOnce(new Error("sitemap unavailable"));

    await expect(
      Effect.runPromise(readPublishedTryoutSitemapCount("id"))
    ).rejects.toThrow("sitemap unavailable");
  });
});
