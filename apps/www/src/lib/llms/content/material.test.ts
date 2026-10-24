// @vitest-environment node

import { beforeEach, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { readMaterialLlmsInventory } from "@/lib/llms/content/material";

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
  it.effect("projects the signed material inventory", () =>
    Effect.gen(function* () {
      expect(yield* readMaterialLlmsInventory("en")).toEqual({
        activeReleaseId: "release-material",
        buckets: ["abc"],
        pageCount: 1,
        routeCount: 1,
      });
    })
  );
});
