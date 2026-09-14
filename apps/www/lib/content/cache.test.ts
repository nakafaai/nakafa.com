// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ContentCacheScopeSchema,
  makeArtifactCacheTag,
  makeContentCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Data, Effect } from "effect";
import {
  applyContentCache,
  applyImmutableContentCache,
  ContentCacheInvalidationError,
  invalidateContentCache,
} from "@/lib/content/cache";

const artifactHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const artifactTag = makeArtifactCacheTag(artifactHash);
const otherArtifactHash = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);
const otherArtifactTag = makeArtifactCacheTag(otherArtifactHash);
const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const revalidateTagMock = vi.hoisted(() => vi.fn());
const invalidateSitemapCacheMock = vi.hoisted(() => vi.fn());

class TestCacheFailure extends Data.TaggedError("TestCacheFailure")<{
  readonly layer: "next" | "sitemap";
}> {}

vi.mock("@/lib/sitemap/cache", () => ({
  /** Records the shared sitemap invalidation without calling Vercel. */
  invalidateSitemapCache: invalidateSitemapCacheMock,
}));
vi.mock("next/cache", () => ({
  /** Records cache profile usage without touching Next internals. */
  cacheLife: cacheLifeMock,
  /** Records cache tag usage without touching Next internals. */
  cacheTag: cacheTagMock,
  /** Records cache invalidation calls without touching Next internals. */
  revalidateTag: revalidateTagMock,
}));
describe("content runtime cache", () => {
  beforeEach(() => {
    cacheLifeMock.mockClear();
    cacheTagMock.mockClear();
    revalidateTagMock.mockClear();
    invalidateSitemapCacheMock.mockReset().mockReturnValue(Effect.void);
  });
  it("keeps combined mutable dependencies explicit", () => {
    applyContentCache("material", "program");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-scope:material",
      "content-scope:program"
    );
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });
  it("gives immutable bodies no mutable or global dependency", () => {
    applyImmutableContentCache([artifactHash, otherArtifactHash]);
    expect(cacheTagMock).toHaveBeenCalledWith(artifactTag, otherArtifactTag);
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });
  it.effect.each(ContentCacheScopeSchema.literals)(
    "invalidates only the changed %s dependency",
    (scope) =>
      Effect.gen(function* () {
        expect(yield* invalidateContentCache(scope)).toBe(scope);
        expect(revalidateTagMock.mock.calls).toEqual([
          [makeContentCacheTag(scope), "max"],
        ]);
        expect(invalidateSitemapCacheMock).toHaveBeenCalledOnce();
      })
  );
  it("revalidates through the runtime profile instead of deleting", () => {
    applyContentCache("material");

    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });
  it.effect(
    "keeps a failed sitemap invalidation in the typed error channel",
    () =>
      Effect.gen(function* () {
        invalidateSitemapCacheMock.mockReturnValueOnce(
          Effect.fail(new TestCacheFailure({ layer: "sitemap" }))
        );

        expect(
          yield* invalidateContentCache("material").pipe(Effect.flip)
        ).toEqual(new ContentCacheInvalidationError({ layer: "sitemap" }));
      })
  );
  it.effect("keeps a failed Next invalidation in the typed error channel", () =>
    Effect.gen(function* () {
      revalidateTagMock.mockImplementationOnce(() => {
        throw new TestCacheFailure({ layer: "next" });
      });

      expect(
        yield* invalidateContentCache("material").pipe(Effect.flip)
      ).toEqual(new ContentCacheInvalidationError({ layer: "next" }));
      expect(invalidateSitemapCacheMock).not.toHaveBeenCalled();
    })
  );
});
