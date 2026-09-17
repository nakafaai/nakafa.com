// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  applySitemapCache,
  CONTENT_SITEMAP_CACHE_TAG,
  invalidateSitemapCache,
  SitemapCacheInvalidationError,
} from "@/lib/sitemap/cache";

const invalidateByTagMock = vi.hoisted(() => vi.fn());
const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const revalidateTagMock = vi.hoisted(() => vi.fn());

vi.mock("@vercel/functions", () => ({
  /** Records stale marking without calling Vercel. */
  invalidateByTag: invalidateByTagMock,
}));

vi.mock("next/cache", () => ({
  /** Records cache profile usage without touching Next internals. */
  cacheLife: cacheLifeMock,
  /** Records cache tag usage without touching Next internals. */
  cacheTag: cacheTagMock,
  /** Records cache invalidation calls without touching Next internals. */
  revalidateTag: revalidateTagMock,
}));

describe("sitemap cache invalidation", () => {
  beforeEach(() => {
    invalidateByTagMock.mockReset().mockResolvedValue(undefined);
    cacheLifeMock.mockReset();
    cacheTagMock.mockReset();
    revalidateTagMock.mockReset();
  });

  it("tags origin reads with only the shared sitemap tag", () => {
    applySitemapCache();

    expect(cacheTagMock).toHaveBeenCalledExactlyOnceWith(
      CONTENT_SITEMAP_CACHE_TAG
    );
    expect(cacheLifeMock).toHaveBeenCalledExactlyOnceWith("max");
  });

  it.effect("marks every bounded sitemap response stale", () =>
    Effect.gen(function* () {
      yield* invalidateSitemapCache();

      expect(revalidateTagMock).toHaveBeenCalledExactlyOnceWith(
        CONTENT_SITEMAP_CACHE_TAG,
        { expire: 0 }
      );
      expect(invalidateByTagMock).toHaveBeenCalledExactlyOnceWith(
        "content-sitemap"
      );
    })
  );

  it.effect(
    "keeps a failed origin invalidation in the typed error channel",
    () =>
      Effect.gen(function* () {
        revalidateTagMock.mockImplementationOnce(() => {
          throw new Error("offline");
        });

        const error = yield* invalidateSitemapCache().pipe(Effect.flip);

        expect(error).toEqual(new SitemapCacheInvalidationError());
        expect(invalidateByTagMock).not.toHaveBeenCalled();
      })
  );

  it.effect("keeps a failed CDN invalidation in the typed error channel", () =>
    Effect.gen(function* () {
      invalidateByTagMock.mockRejectedValueOnce(new Error("offline"));

      const error = yield* invalidateSitemapCache().pipe(Effect.flip);

      expect(error).toEqual(new SitemapCacheInvalidationError());
    })
  );
});
