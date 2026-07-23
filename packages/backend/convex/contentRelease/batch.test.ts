import {
  hashBatch,
  validateStoredBatch,
} from "@repo/backend/convex/contentRelease/batch";
import { Effect, Exit } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/batch", () => {
  it("binds batch identity to kind, release, index, order, and exact bytes", async () => {
    const baseline = await Effect.runPromise(
      hashBatch("item", "release-a", 0, ["first", "second"])
    );
    const same = await Effect.runPromise(
      hashBatch("item", "release-a", 0, ["first", "second"])
    );
    const variants = await Effect.runPromise(
      Effect.all([
        hashBatch("artifact", "release-a", 0, ["first", "second"]),
        hashBatch("item", "release-b", 0, ["first", "second"]),
        hashBatch("item", "release-a", 1, ["first", "second"]),
        hashBatch("item", "release-a", 0, ["second", "first"]),
        hashBatch("item", "release-a", 0, ["first", "changed"]),
      ])
    );

    expect(same).toBe(baseline);
    expect(new Set(variants).size).toBe(variants.length);
    expect(variants).not.toContain(baseline);
  });

  it("accepts only a complete immutable retry identity", async () => {
    await expect(
      Effect.runPromise(
        validateStoredBatch(
          2,
          2,
          ["batch-hash", "batch-hash"],
          "batch-hash",
          "release-a",
          0
        )
      )
    ).resolves.toBeUndefined();

    const wrongCount = await Effect.runPromiseExit(
      validateStoredBatch(1, 2, ["batch-hash"], "batch-hash", "release-a", 0)
    );
    const wrongHash = await Effect.runPromiseExit(
      validateStoredBatch(
        2,
        2,
        ["batch-hash", "changed"],
        "batch-hash",
        "release-a",
        0
      )
    );

    expect(Exit.isFailure(wrongCount)).toBe(true);
    expect(Exit.isFailure(wrongHash)).toBe(true);
  });
});
