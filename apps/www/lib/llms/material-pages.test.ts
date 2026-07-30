// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readMaterialLlmsInventory } from "@/lib/llms/material-pages";

const mockReadCounts = vi.hoisted(() => vi.fn());
const mockReadPublishedBuckets = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/material/sitemap", () => ({
  readPublishedMaterialBuckets: mockReadPublishedBuckets,
}));
vi.mock("@/lib/content/runtime/routes", () => ({
  getRuntimeContentRouteCounts: mockReadCounts,
}));

beforeEach(() => {
  mockReadCounts
    .mockReset()
    .mockReturnValue(
      Effect.succeed([{ count: 100, locale: "en", section: "material" }])
    );
  mockReadPublishedBuckets.mockReset().mockReturnValue(
    Effect.succeed({
      activeReleaseId: null,
      buckets: [],
      managed: false,
      materialCount: 0,
    })
  );
});

describe("material LLMS pages", () => {
  it("selects source, mixed, and published page inventories", async () => {
    await expect(
      Effect.runPromise(readMaterialLlmsInventory("en"))
    ).resolves.toEqual({
      activeReleaseId: null,
      buckets: [],
      owner: "source",
      pageCount: 1,
      publishedRouteCount: 0,
      sourcePageCount: 1,
      sourceRouteCount: 100,
    });

    mockReadPublishedBuckets.mockReturnValueOnce(
      Effect.succeed({
        activeReleaseId: "release-material",
        buckets: ["abc"],
        managed: false,
        materialCount: 1,
      })
    );
    await expect(
      Effect.runPromise(readMaterialLlmsInventory("en"))
    ).resolves.toMatchObject({
      activeReleaseId: "release-material",
      buckets: ["abc"],
      owner: "mixed",
      pageCount: 2,
      publishedRouteCount: 1,
    });

    mockReadPublishedBuckets.mockReturnValueOnce(
      Effect.succeed({
        activeReleaseId: "release-material",
        buckets: ["abc"],
        managed: true,
        materialCount: 1,
      })
    );
    await expect(
      Effect.runPromise(readMaterialLlmsInventory("en"))
    ).resolves.toEqual({
      activeReleaseId: "release-material",
      buckets: ["abc"],
      owner: "published",
      pageCount: 1,
      publishedRouteCount: 1,
      sourcePageCount: 0,
      sourceRouteCount: 0,
    });

    mockReadCounts.mockReturnValueOnce(Effect.succeed([]));
    await expect(
      Effect.runPromise(readMaterialLlmsInventory("en"))
    ).resolves.toMatchObject({
      owner: "source",
      pageCount: 0,
      sourceRouteCount: 0,
    });
  });
});
