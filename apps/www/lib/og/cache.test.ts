// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { ReleaseIdSchema } from "@nakafa/aksara-contracts/ids";
import { Effect } from "effect";
import { invalidateOgCache, OgCacheInvalidationError } from "@/lib/og/cache";
import { OG_CACHE_TAG } from "@/lib/og/headers";
import { resetTestRuntimeCache } from "@/test/store";

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
    /** Records the stale marking without calling Vercel. */
    invalidateByTag: invalidateByTagMock,
  };
});

vi.mock("@/lib/content/published/active", () => ({
  expireActiveContentIdentity: activeMocks.expire,
  loadActiveContentIdentity: activeMocks.load,
  readActiveContentIdentity: activeMocks.read,
}));

const releaseId = ReleaseIdSchema.make("release-og");

describe("social image cache invalidation", () => {
  beforeEach(() => {
    invalidateByTagMock.mockReset().mockResolvedValue(undefined);
    activeMocks.load.mockReset().mockReturnValue(
      Effect.succeed({
        manifestHash: `sha256:${"a".repeat(64)}`,
        releaseId,
        sequence: 1,
      })
    );
    resetTestRuntimeCache();
  });

  it.effect(
    "marks every social image response stale, once for the release",
    () =>
      Effect.gen(function* () {
        yield* invalidateOgCache(releaseId);
        yield* invalidateOgCache(releaseId);

        expect(invalidateByTagMock).toHaveBeenCalledExactlyOnceWith(
          OG_CACHE_TAG
        );
      })
  );

  it.effect("keeps a failed CDN invalidation in the typed error channel", () =>
    Effect.gen(function* () {
      invalidateByTagMock.mockRejectedValueOnce(new Error("offline"));

      const error = yield* invalidateOgCache(releaseId).pipe(Effect.flip);

      expect(error).toEqual(new OgCacheInvalidationError());
    })
  );
});
