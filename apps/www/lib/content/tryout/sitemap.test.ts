// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPublishedTryoutSitemap,
  readPublishedTryoutSitemapCount,
} from "@/lib/content/tryout/sitemap";

const runtimeQueryMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

describe("published try-out sitemap", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
  });

  it("reads route inventory and one exact bounded page", async () => {
    runtimeQueryMock
      .mockResolvedValueOnce({ pageCount: 1, routeCount: 2 })
      .mockResolvedValueOnce({ paths: ["try-out/alpha", "try-out/zeta"] });

    await expect(
      Effect.runPromise(readPublishedTryoutSitemapCount("en"))
    ).resolves.toEqual({ pageCount: 1, routeCount: 2 });
    await expect(
      Effect.runPromise(readPublishedTryoutSitemap("en", 0))
    ).resolves.toEqual({ paths: ["try-out/alpha", "try-out/zeta"] });
    expect(runtimeQueryMock).toHaveBeenNthCalledWith(1, expect.anything(), {
      appLocale: "en",
    });
    expect(runtimeQueryMock).toHaveBeenNthCalledWith(2, expect.anything(), {
      appLocale: "en",
      page: 0,
    });
  });

  it("preserves runtime query failures in the Effect error channel", async () => {
    runtimeQueryMock.mockRejectedValueOnce(new Error("sitemap unavailable"));

    await expect(
      Effect.runPromise(readPublishedTryoutSitemapCount("id"))
    ).rejects.toThrow("sitemap unavailable");
  });
});
