import { beforeEach, describe, expect, it, vi } from "vitest";

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

  it("applies both shared tags to published material caches", async () => {
    const cache = await import("@/lib/content/cache");

    cache.applyPublishedContentCache();

    expect(cacheTagMock).toHaveBeenCalledWith(
      "content-runtime",
      "content-family:material"
    );
    expect(cacheLifeMock).toHaveBeenCalledWith("contentRuntime");
  });

  it("invalidates the exact shared material tags immediately", async () => {
    const cache = await import("@/lib/content/cache");

    expect(cache.revalidateMaterialCache()).toEqual([
      "content-runtime",
      "content-family:material",
    ]);
    expect(revalidateTagMock.mock.calls).toEqual([
      ["content-runtime", { expire: 0 }],
      ["content-family:material", { expire: 0 }],
    ]);
  });
});
