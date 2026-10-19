// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ReleaseIdSchema,
  Sha256HashSchema,
} from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import {
  CONTENT_SITEMAP_CACHE_TAG,
  invalidateSitemapCache,
  SitemapCacheInvalidationError,
} from "@/lib/sitemap/cache";
import { resetTestRuntimeCache, testRuntimeCache } from "@/test/store";

const invalidateByTagMock = vi.hoisted(() => vi.fn());
const activeMocks = vi.hoisted(() => ({
  expire: vi.fn(),
  load: vi.fn(),
  read: vi.fn(),
}));

vi.mock("@vercel/functions", async () => {
  const { testRuntimeCache: cache } = await import("@/test/store");
  return {
    getCache: () => cache,
    /** Records stale marking without calling Vercel. */
    invalidateByTag: invalidateByTagMock,
  };
});

vi.mock("@/lib/content/published/active", () => ({
  expireActiveContentIdentity: activeMocks.expire,
  loadActiveContentIdentity: activeMocks.load,
  readActiveContentIdentity: activeMocks.read,
}));

const releaseId = ReleaseIdSchema.make("release-sitemap");
const nextReleaseId = ReleaseIdSchema.make("release-next");

/** The active identity that Convex answers while one release is active. */
const identityOf = (id: typeof releaseId) => ({
  manifestHash: Sha256HashSchema.make(`sha256:${"a".repeat(64)}`),
  releaseId: id,
  sequence: 1,
});

describe("sitemap cache invalidation", () => {
  beforeEach(() => {
    invalidateByTagMock.mockReset().mockResolvedValue(undefined);
    activeMocks.load
      .mockReset()
      .mockReturnValue(Effect.succeed(identityOf(releaseId)));
    activeMocks.read
      .mockReset()
      .mockReturnValue(Effect.succeed(identityOf(releaseId)));
    resetTestRuntimeCache();
  });

  it.effect("marks every bounded sitemap response stale", () =>
    Effect.gen(function* () {
      yield* invalidateSitemapCache(releaseId);

      expect(testRuntimeCache.expireTag).toHaveBeenCalledExactlyOnceWith(
        CONTENT_SITEMAP_CACHE_TAG
      );
      expect(invalidateByTagMock).toHaveBeenCalledExactlyOnceWith(
        "content-sitemap"
      );
    })
  );

  it.effect(
    "purges once for every release however many scopes it changes",
    () =>
      Effect.gen(function* () {
        yield* invalidateSitemapCache(releaseId);
        yield* invalidateSitemapCache(releaseId);
        yield* invalidateSitemapCache(releaseId);

        expect(testRuntimeCache.expireTag).toHaveBeenCalledTimes(1);
        expect(invalidateByTagMock).toHaveBeenCalledTimes(1);
      })
  );

  it.effect("purges again for the next release", () =>
    Effect.gen(function* () {
      yield* invalidateSitemapCache(releaseId);

      activeMocks.load.mockReturnValue(
        Effect.succeed(identityOf(nextReleaseId))
      );
      yield* invalidateSitemapCache(nextReleaseId);
      yield* invalidateSitemapCache(nextReleaseId);

      expect(testRuntimeCache.expireTag).toHaveBeenCalledTimes(2);
      expect(invalidateByTagMock).toHaveBeenCalledTimes(2);
    })
  );

  it.effect("files the purge under the named release, not the pointer's", () =>
    Effect.gen(function* () {
      activeMocks.read.mockReturnValue(
        Effect.succeed(identityOf(nextReleaseId))
      );

      yield* invalidateSitemapCache(releaseId);
      yield* invalidateSitemapCache(releaseId);

      expect(activeMocks.read).not.toHaveBeenCalled();
      expect(invalidateByTagMock).toHaveBeenCalledTimes(1);
    })
  );

  it.effect(
    "keeps a failed store invalidation in the typed error channel",
    () =>
      Effect.gen(function* () {
        testRuntimeCache.expireTag.mockImplementationOnce(() => {
          throw new Error("offline");
        });

        const error = yield* invalidateSitemapCache(releaseId).pipe(
          Effect.flip
        );

        expect(error).toEqual(new SitemapCacheInvalidationError());
        expect(invalidateByTagMock).not.toHaveBeenCalled();
      })
  );

  it.effect("keeps a failed CDN invalidation in the typed error channel", () =>
    Effect.gen(function* () {
      invalidateByTagMock.mockRejectedValueOnce(new Error("offline"));

      const error = yield* invalidateSitemapCache(releaseId).pipe(Effect.flip);

      expect(error).toEqual(new SitemapCacheInvalidationError());
    })
  );

  it.effect("purges again on the retry of a call that failed", () =>
    Effect.gen(function* () {
      invalidateByTagMock.mockRejectedValueOnce(new Error("offline"));
      yield* invalidateSitemapCache(releaseId).pipe(Effect.flip);

      yield* invalidateSitemapCache(releaseId);

      expect(invalidateByTagMock).toHaveBeenCalledTimes(2);
    })
  );
});
