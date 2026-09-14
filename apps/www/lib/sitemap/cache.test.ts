// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  invalidateSitemapCache,
  SitemapCacheInvalidationError,
} from "@/lib/sitemap/cache";

const invalidateByTagMock = vi.hoisted(() => vi.fn());

vi.mock("@vercel/functions", () => ({
  /** Records stale marking without calling Vercel. */
  invalidateByTag: invalidateByTagMock,
}));

describe("sitemap cache invalidation", () => {
  beforeEach(() => {
    invalidateByTagMock.mockReset().mockResolvedValue(undefined);
  });

  it.effect("marks every bounded sitemap response stale", () =>
    Effect.gen(function* () {
      yield* invalidateSitemapCache();

      expect(invalidateByTagMock).toHaveBeenCalledExactlyOnceWith(
        "content-sitemap"
      );
    })
  );

  it.effect("keeps a failed invalidation in the typed error channel", () =>
    Effect.gen(function* () {
      invalidateByTagMock.mockRejectedValueOnce(new Error("offline"));

      const error = yield* invalidateSitemapCache().pipe(Effect.flip);

      expect(error).toEqual(new SitemapCacheInvalidationError());
    })
  );
});
