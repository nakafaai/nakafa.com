import { beforeEach, describe, expect, it } from "@effect/vitest";
import {
  ArtifactCacheTagSchema,
  ContentCacheTagsSchema,
  makeArtifactCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Data, Effect, Schema } from "effect";
import { vi } from "vitest";
import {
  applyContentRuntimeCache,
  applyPublishedCatalogCache,
  applyPublishedContentBatchCache,
  applyPublishedContentCache,
  applyPublishedSnapshotCache,
  ContentCacheInvalidationError,
  invalidateContentCache,
} from "@/lib/content/cache";

const artifactHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const artifactTag = makeArtifactCacheTag(artifactHash);
const otherArtifactHash = Sha256HashSchema.make(`sha256:${"b".repeat(64)}`);
const otherArtifactTag = makeArtifactCacheTag(otherArtifactHash);
const familyCacheTags = Schema.decodeSync(ContentCacheTagsSchema)([
  "content-runtime",
  "content-family:material",
]);
const artifactCacheTags = Schema.decodeSync(ContentCacheTagsSchema)([
  ...familyCacheTags,
  artifactTag,
]);
const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const revalidateTagMock = vi.hoisted(() => vi.fn());
const dangerouslyDeleteByTagMock = vi.hoisted(() => vi.fn());

class TestCacheFailure extends Data.TaggedError("TestCacheFailure")<{
  readonly layer: "next" | "sitemap";
}> {}

vi.mock("@vercel/functions", () => ({
  /** Records immediate CDN deletion without calling Vercel. */
  dangerouslyDeleteByTag: dangerouslyDeleteByTagMock,
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
    dangerouslyDeleteByTagMock.mockReset().mockResolvedValue(undefined);
  });
  it("applies the shared tag and cache profile", () => {
    applyContentRuntimeCache();
    expect(cacheTagMock).toHaveBeenCalledWith("content-runtime");
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });
  it("applies global and exact immutable snapshot tags", () => {
    applyPublishedSnapshotCache(artifactHash);
    expect(cacheTagMock).toHaveBeenCalledWith("content-runtime", artifactTag);
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });
  it("applies global, family, and exact artifact tags", () => {
    applyPublishedContentCache("material", artifactHash);
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:material",
      artifactTag
    );
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });
  it("applies every immutable artifact tag in a bounded batch", () => {
    applyPublishedContentBatchCache("question", [
      artifactHash,
      otherArtifactHash,
    ]);
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:question",
      artifactTag,
      otherArtifactTag
    );
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });
  it("applies global and family tags to published catalogs", () => {
    applyPublishedCatalogCache("article");
    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:article"
    );
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });
  it.effect("invalidates exact Next tags and the sitemap CDN tag", () =>
    Effect.gen(function* () {
      expect(yield* invalidateContentCache(artifactCacheTags)).toEqual(
        artifactCacheTags
      );
      expect(revalidateTagMock.mock.calls).toEqual([
        ["content-runtime", { expire: 0 }],
        ["content-family:material", { expire: 0 }],
        [artifactTag, { expire: 0 }],
      ]);
      expect(dangerouslyDeleteByTagMock).toHaveBeenCalledWith(
        "content-sitemap",
        { revalidationDeadlineSeconds: 0 }
      );
    })
  );
  it.effect("keeps a failed CDN purge in the typed error channel", () =>
    Effect.gen(function* () {
      dangerouslyDeleteByTagMock.mockRejectedValueOnce(
        new TestCacheFailure({ layer: "sitemap" })
      );

      expect(
        yield* invalidateContentCache(familyCacheTags).pipe(Effect.flip)
      ).toEqual(new ContentCacheInvalidationError({ layer: "sitemap" }));
    })
  );
  it.effect("keeps a failed Next invalidation in the typed error channel", () =>
    Effect.gen(function* () {
      revalidateTagMock.mockImplementationOnce(() => {
        throw new TestCacheFailure({ layer: "next" });
      });

      expect(
        yield* invalidateContentCache(familyCacheTags).pipe(Effect.flip)
      ).toEqual(new ContentCacheInvalidationError({ layer: "next" }));
      expect(dangerouslyDeleteByTagMock).not.toHaveBeenCalled();
    })
  );
  it("rejects an artifact tag without a canonical signed hash", () => {
    expect(() =>
      Schema.decodeSync(ArtifactCacheTagSchema)("content-artifact:unknown")
    ).toThrow(
      "Expected content-artifact followed by one canonical SHA-256 hash."
    );
  });
});
