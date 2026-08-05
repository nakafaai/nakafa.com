// @vitest-environment node

import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readMaterialLlmsInventory } from "@/lib/llms/material-pages";

const mockReadPublishedBuckets = vi.hoisted(() => vi.fn());

vi.mock("@/lib/content/material/sitemap", () => ({
  readPublishedMaterialBuckets: mockReadPublishedBuckets,
}));

beforeEach(() => {
  mockReadPublishedBuckets.mockReset().mockReturnValue(
    Effect.succeed({
      activeReleaseId: "release-material",
      buckets: ["abc"],
      materialCount: 1,
    })
  );
});

describe("material LLMS pages", () => {
  it("projects the signed material inventory", async () => {
    await expect(
      Effect.runPromise(readMaterialLlmsInventory("en"))
    ).resolves.toEqual({
      activeReleaseId: "release-material",
      buckets: ["abc"],
      pageCount: 1,
      routeCount: 1,
    });
  });
});
