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

  it("invalidates the shared tag immediately after sync", async () => {
    const cache = await import("@/lib/content/cache");

    const tags = cache.revalidateContentRuntimeCache();

    expect(tags).toEqual(["content-runtime"]);
    expect(revalidateTagMock).toHaveBeenCalledWith("content-runtime", {
      expire: 0,
    });
  });
});
