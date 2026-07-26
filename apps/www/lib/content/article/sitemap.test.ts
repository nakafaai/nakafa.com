// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  readPublishedArticleBuckets,
  readPublishedArticleSitemap,
} from "@/lib/content/article/sitemap";

const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/lib/content/runtime/query", () => ({
  fetchRuntimeQuery: fetchMock,
  readRuntimeQuery: (_name: string, read: () => Promise<unknown>) =>
    Effect.tryPromise({
      catch: (cause) => cause,
      try: read,
    }),
}));

describe("published article sitemap", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("reads bucket discovery and one exact route partition", async () => {
    fetchMock
      .mockResolvedValueOnce({
        articleCount: 1,
        buckets: ["abc"],
        managed: true,
      })
      .mockResolvedValueOnce({
        routes: [
          {
            date: "2026-07-23",
            publicPath: "articles/politics/article",
          },
        ],
      });

    await expect(
      Effect.runPromise(readPublishedArticleBuckets("en"))
    ).resolves.toEqual({
      articleCount: 1,
      buckets: ["abc"],
      managed: true,
    });
    await expect(
      Effect.runPromise(readPublishedArticleSitemap("en", "abc"))
    ).resolves.toMatchObject({
      routes: [{ publicPath: "articles/politics/article" }],
    });
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.anything(), {
      locale: "en",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.anything(), {
      bucket: "abc",
      locale: "en",
    });
  });

  it("preserves runtime query failures in the Effect error channel", async () => {
    fetchMock.mockRejectedValueOnce(new Error("sitemap unavailable"));

    await expect(
      Effect.runPromise(readPublishedArticleBuckets("id"))
    ).rejects.toThrow("sitemap unavailable");
  });
});
