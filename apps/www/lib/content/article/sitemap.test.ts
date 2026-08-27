// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { vi } from "vitest";
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

  it.effect("reads bucket discovery and one exact route partition", () =>
    Effect.gen(function* () {
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

      const buckets = yield* readPublishedArticleBuckets("en");
      expect(buckets).toEqual({
        activeReleaseId,
        articleCount: 1,
        buckets: ["abc"],
      });
      const sitemap = yield* readPublishedArticleSitemap("en", "abc");
      expect(sitemap).toMatchObject({
        routes: [{ publicPath: "articles/politics/article" }],
      });
      expect(runtimeQueryMock).toHaveBeenNthCalledWith(1, expect.anything(), {
        appLocale: "en",
      });
      expect(runtimeQueryMock).toHaveBeenNthCalledWith(2, expect.anything(), {
        appLocale: "en",
        bucket: "abc",
      });
    })
  );

  it.effect("rejects an unmanaged article sitemap inventory", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce({
        activeReleaseId: null,
        articleCount: 0,
        buckets: [],
        managed: false,
      });

      const error = yield* readPublishedArticleBuckets("en").pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "PublishedProjectionError" });
    })
  );

  it.effect(
    "preserves runtime query failures in the Effect error channel",
    () =>
      Effect.gen(function* () {
        runtimeQueryMock.mockRejectedValueOnce(
          new Error("sitemap unavailable")
        );

        const error = yield* readPublishedArticleBuckets("id").pipe(
          Effect.flip
        );
        expect(error).toMatchObject({
          _tag: "TestRuntimeQueryError",
          message: "Error: sitemap unavailable",
        });
      })
  );

  it.effect("rejects a sitemap inventory from another signed release", () =>
    Effect.gen(function* () {
      runtimeQueryMock.mockResolvedValueOnce({
        activeReleaseId: "release-next",
        articleCount: 1,
        buckets: ["abc"],
        managed: true,
      });

      const error = yield* readPublishedArticleBuckets(
        "de",
        activeReleaseId
      ).pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "PublishedReleaseMismatchError" });
    })
  );
});
