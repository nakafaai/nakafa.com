// @vitest-environment node

import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPublishedArticleBuckets,
  readPublishedArticleSitemap,
} from "@/lib/content/article/sitemap";

const runtimeQueryMock = vi.hoisted(() => vi.fn());
const activeReleaseId = ReleaseIdSchema.make("release-article");

vi.mock("@/lib/content/runtime/query", async () => {
  const { createTestRuntimeQuery } = await import("@/test/runtime-query");
  return {
    readRuntimeQuery: createTestRuntimeQuery(runtimeQueryMock),
  };
});

describe("published article sitemap", () => {
  beforeEach(() => {
    runtimeQueryMock.mockReset();
  });

  it("reads bucket discovery and one exact route partition", async () => {
    runtimeQueryMock
      .mockResolvedValueOnce({
        activeReleaseId,
        articleCount: 1,
        buckets: ["abc"],
        managed: true,
      })
      .mockResolvedValueOnce({
        routes: [
          {
            lastModified: "2026-07-23",
            publicPath: "articles/politics/article",
          },
        ],
      });

    await expect(
      Effect.runPromise(readPublishedArticleBuckets("en"))
    ).resolves.toEqual({
      activeReleaseId,
      articleCount: 1,
      buckets: ["abc"],
    });
    await expect(
      Effect.runPromise(readPublishedArticleSitemap("en", "abc"))
    ).resolves.toMatchObject({
      routes: [{ publicPath: "articles/politics/article" }],
    });
    expect(runtimeQueryMock).toHaveBeenNthCalledWith(1, expect.anything(), {
      appLocale: "en",
    });
    expect(runtimeQueryMock).toHaveBeenNthCalledWith(2, expect.anything(), {
      appLocale: "en",
      bucket: "abc",
    });
  });

  it("rejects an unmanaged article sitemap inventory", async () => {
    runtimeQueryMock.mockResolvedValueOnce({
      activeReleaseId: null,
      articleCount: 0,
      buckets: [],
      managed: false,
    });

    await expect(
      Effect.runPromise(readPublishedArticleBuckets("en").pipe(Effect.flip))
    ).resolves.toMatchObject({ _tag: "PublishedProjectionError" });
  });

  it("preserves runtime query failures in the Effect error channel", async () => {
    runtimeQueryMock.mockRejectedValueOnce(new Error("sitemap unavailable"));

    await expect(
      Effect.runPromise(readPublishedArticleBuckets("id"))
    ).rejects.toThrow("sitemap unavailable");
  });

  it("rejects a sitemap inventory from another signed release", async () => {
    runtimeQueryMock.mockResolvedValueOnce({
      activeReleaseId: "release-next",
      articleCount: 1,
      buckets: ["abc"],
      managed: true,
    });

    await expect(
      Effect.runPromise(
        readPublishedArticleBuckets("de", activeReleaseId).pipe(Effect.flip)
      )
    ).resolves.toMatchObject({ _tag: "PublishedReleaseMismatchError" });
  });
});
