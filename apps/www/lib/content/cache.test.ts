import {
  ArtifactCacheTagSchema,
  ContentCacheTagsSchema,
  makeArtifactCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Effect, Either, Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const artifactHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const artifactTag = makeArtifactCacheTag(artifactHash);
const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const revalidateTagMock = vi.hoisted(() => vi.fn());
const dangerouslyDeleteByTagMock = vi.hoisted(() => vi.fn());

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

  it("applies the shared tag and cache profile", async () => {
    const cache = await import("@/lib/content/cache");

    cache.applyContentRuntimeCache();

    expect(cacheTagMock).toHaveBeenCalledWith("content-runtime");
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });

  it("applies global, family, and exact artifact tags", async () => {
    const cache = await import("@/lib/content/cache");

    cache.applyPublishedContentCache("material", artifactHash);

    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:material",
      artifactTag
    );
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });

  it("applies global and family tags to published catalogs", async () => {
    const cache = await import("@/lib/content/cache");

    cache.applyPublishedCatalogCache("article");

    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:article"
    );
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });

  it("invalidates exact Next tags and the sitemap CDN tag", async () => {
    const cache = await import("@/lib/content/cache");
    const tags = Schema.decodeUnknownSync(ContentCacheTagsSchema)([
      "content-runtime",
      "content-family:material",
      artifactTag,
    ]);

    await expect(
      Effect.runPromise(cache.invalidateContentCache(tags))
    ).resolves.toEqual(tags);
    expect(revalidateTagMock.mock.calls).toEqual([
      ["content-runtime", { expire: 0 }],
      ["content-family:material", { expire: 0 }],
      [artifactTag, { expire: 0 }],
    ]);
    expect(dangerouslyDeleteByTagMock).toHaveBeenCalledWith("content-sitemap", {
      revalidationDeadlineSeconds: 0,
    });
  });

  it("keeps a failed CDN purge in the typed error channel", async () => {
    dangerouslyDeleteByTagMock.mockRejectedValueOnce(new Error("unavailable"));
    const cache = await import("@/lib/content/cache");
    const tags = Schema.decodeUnknownSync(ContentCacheTagsSchema)([
      "content-runtime",
      "content-family:material",
    ]);

    const result = await Effect.runPromise(
      cache.invalidateContentCache(tags).pipe(Effect.either)
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toEqual(
        new cache.ContentCacheInvalidationError({ layer: "sitemap" })
      );
    }
  });

  it("keeps a failed Next invalidation in the typed error channel", async () => {
    revalidateTagMock.mockImplementationOnce(() => {
      throw new Error("unavailable");
    });
    const cache = await import("@/lib/content/cache");
    const tags = Schema.decodeUnknownSync(ContentCacheTagsSchema)([
      "content-runtime",
      "content-family:material",
    ]);

    const result = await Effect.runPromise(
      cache.invalidateContentCache(tags).pipe(Effect.either)
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) {
      expect(result.left).toEqual(
        new cache.ContentCacheInvalidationError({ layer: "next" })
      );
    }
    expect(dangerouslyDeleteByTagMock).not.toHaveBeenCalled();
  });

  it("rejects an artifact tag without a canonical signed hash", async () => {
    await import("@/lib/content/cache");

    expect(() =>
      Schema.decodeUnknownSync(ArtifactCacheTagSchema)(
        "content-artifact:unknown"
      )
    ).toThrow(
      "Expected content-artifact followed by one canonical SHA-256 hash."
    );
  });
});
