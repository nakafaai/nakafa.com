// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ContentCacheScopeSchema,
  makeContentCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { Effect } from "effect";
import {
  ContentCacheInvalidationError,
  invalidateContentCache,
} from "@/lib/content/cache";
import { resetTestRuntimeCache, testRuntimeCache } from "@/test/store";

vi.mock("@vercel/functions", async () => {
  const { testRuntimeCache: cache } = await import("@/test/store");
  return { getCache: () => cache };
});

describe("content cache invalidation", () => {
  beforeEach(() => {
    resetTestRuntimeCache();
  });

  it.effect.each(ContentCacheScopeSchema.literals)(
    "expires only the changed %s dependency",
    (scope) =>
      Effect.gen(function* () {
        expect(yield* invalidateContentCache(scope)).toBe(scope);
        expect(testRuntimeCache.expireTag.mock.calls).toEqual([
          [makeContentCacheTag(scope)],
        ]);
      })
  );

  it.effect(
    "keeps a failed store invalidation in the typed error channel",
    () =>
      Effect.gen(function* () {
        testRuntimeCache.expireTag.mockImplementationOnce(() => {
          throw new Error("store unavailable");
        });

        expect(
          yield* invalidateContentCache("material").pipe(Effect.flip)
        ).toEqual(new ContentCacheInvalidationError());
      })
  );
});
