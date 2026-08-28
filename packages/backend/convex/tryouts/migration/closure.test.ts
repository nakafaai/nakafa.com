import { assert, describe, it } from "@effect/vitest";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import { loadTargetArtifacts } from "@repo/backend/convex/tryouts/migration/closure";
import type { mapEntryValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import type { Infer } from "convex/values";
import { Effect } from "effect";

type MapEntry = Infer<typeof mapEntryValidator>;

/** Creates one exact source-to-target artifact mapping for closure tests. */
function artifactMapping(index: number): MapEntry {
  const oldHash = `sha256:${index.toString(16).padStart(64, "0")}`;
  return {
    identity: oldHash,
    index,
    kind: "artifact",
    newHash: `sha256:${(index + 1).toString(16).padStart(64, "0")}`,
    oldHash,
  };
}

describe("tryouts/migration/closure", () => {
  it.effect("reads the full retained artifact closure in bounded order", () =>
    Effect.gen(function* () {
      const mappings = Array.from(
        { length: retainedTryoutHistoryPlan.artifactCount },
        (_, index) => artifactMapping(index)
      );
      const batchSizes: number[] = [];
      const stored = yield* loadTargetArtifacts(mappings, (oldHashes) =>
        Effect.sync(() => {
          batchSizes.push(oldHashes.length);
          return oldHashes.map((oldHash) => ({
            artifactHash: `target:${oldHash}`,
            artifactJson: JSON.stringify({ oldHash }),
            oldHash,
          }));
        })
      );

      assert.strictEqual(
        stored.length,
        retainedTryoutHistoryPlan.artifactCount
      );
      assert.deepStrictEqual(
        stored.map(({ oldHash }) => oldHash),
        mappings.map(({ oldHash }) => oldHash)
      );
      assert.deepStrictEqual(batchSizes, [
        ...Array.from({ length: 13 }, () => 128),
        16,
      ]);
    })
  );
});
