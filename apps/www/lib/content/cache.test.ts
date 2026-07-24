import {
  ArtifactCacheTagSchema,
  ContentCacheTagsSchema,
  makeArtifactCacheTag,
} from "@nakafa/aksara-contracts/cache/content";
import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { Schema } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

const artifactHash = Sha256HashSchema.make(`sha256:${"a".repeat(64)}`);
const artifactTag = makeArtifactCacheTag(artifactHash);
const cacheLifeMock = vi.hoisted(() => vi.fn());
const cacheTagMock = vi.hoisted(() => vi.fn());
const revalidateTagMock = vi.hoisted(() => vi.fn());

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

  it("invalidates only the decoded exact artifact tags requested", async () => {
    const cache = await import("@/lib/content/cache");
    const tags = Schema.decodeUnknownSync(ContentCacheTagsSchema)([
      "content-runtime",
      "content-family:material",
      artifactTag,
    ]);

    expect(cache.revalidateContentCache(tags)).toEqual(tags);
    expect(revalidateTagMock.mock.calls).toEqual([
      ["content-runtime", { expire: 0 }],
      ["content-family:material", { expire: 0 }],
      [artifactTag, { expire: 0 }],
    ]);
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
