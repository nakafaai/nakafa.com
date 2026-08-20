import {
  hashBatch,
  validateStoredBatch,
} from "@repo/backend/convex/contentRelease/batch";
import { describe, expect, it } from "@repo/testing/effect";
import { Effect, Exit } from "effect";

describe("contentRelease/batch", () => {
  it.live(
    "binds batch identity to kind, release, index, order, and exact bytes",
    () =>
      Effect.gen(function* () {
        const baseline = yield* hashBatch("item", "release-a", 0, [
          "first",
          "second",
        ]);
        const same = yield* hashBatch("item", "release-a", 0, [
          "first",
          "second",
        ]);
        const variants = yield* Effect.all([
          hashBatch("artifact", "release-a", 0, ["first", "second"]),
          hashBatch("item", "release-b", 0, ["first", "second"]),
          hashBatch("item", "release-a", 1, ["first", "second"]),
          hashBatch("item", "release-a", 0, ["second", "first"]),
          hashBatch("item", "release-a", 0, ["first", "changed"]),
        ]);

        expect(same).toBe(baseline);
        expect(new Set(variants).size).toBe(variants.length);
        expect(variants).not.toContain(baseline);
      })
  );

  it.live("accepts only a complete immutable retry identity", () =>
    Effect.gen(function* () {
      expect(
        yield* validateStoredBatch(
          2,
          2,
          ["batch-hash", "batch-hash"],
          "batch-hash",
          "release-a",
          0
        )
      ).toBeUndefined();

      const wrongCount = yield* Effect.exit(
        validateStoredBatch(1, 2, ["batch-hash"], "batch-hash", "release-a", 0)
      );
      const wrongHash = yield* Effect.exit(
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
    })
  );
});
