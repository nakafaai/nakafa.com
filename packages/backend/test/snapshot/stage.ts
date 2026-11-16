import type { ContentSnapshotRow } from "@nakafa/aksara-contracts/release/snapshot/data";
import type { StageSnapshotBatchInputSchema } from "@nakafa/aksara-contracts/transport/snapshot";
import { stageRow } from "@repo/backend/confect/contentRelease/snapshot/batch";
import {
  prepareRow,
  prepareSnapshotStage,
} from "@repo/backend/confect/contentRelease/snapshot/prepare";
import type schema from "@repo/backend/convex/schema";
import type { TestConvex } from "convex-test";
import { Effect } from "effect";

/**
 * Prepares one row as the ingress action does and stores it at one index as
 * the staging mutation does, for tests that place rows one at a time.
 */
export const stageTestRow = Effect.fn("TestSnapshot.stageRow")(function* (
  snapshotId: string,
  index: number,
  row: ContentSnapshotRow,
  rowJson: string
) {
  const prepared = yield* prepareRow(
    { batchIndex: 0, offset: index, snapshotId },
    row,
    rowJson
  );
  return yield* stageRow(snapshotId, index, prepared);
});

/**
 * Builds the staging mutation arguments of one batch from the manifests the
 * test deployment stores, exactly as the ingress action does.
 */
export const testSnapshotBatchArgs = Effect.fn("TestSnapshot.batchArgs")(
  function* (
    t: TestConvex<typeof schema>,
    input: typeof StageSnapshotBatchInputSchema.Type
  ) {
    const stored = yield* Effect.promise(() =>
      t.run(async (ctx) => {
        const release = await ctx.db
          .query("contentReleases")
          .withIndex("by_releaseId", (q) => q.eq("releaseId", input.releaseId))
          .unique();
        const snapshot = await ctx.db
          .query("contentSnapshots")
          .withIndex("by_family_and_snapshotId", (q) =>
            q.eq("family", input.family).eq("snapshotId", input.snapshotId)
          )
          .unique();
        return {
          releaseJson: release?.releaseJson ?? "",
          snapshotJson: snapshot?.snapshotJson ?? "",
        };
      })
    );
    return yield* prepareSnapshotStage(input, stored);
  }
);
