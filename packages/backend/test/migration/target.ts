import { strict as assert } from "node:assert/strict";
import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";

export interface CleanupTarget {
  readonly attemptId: Id<"tryoutAttempts">;
  readonly bundleHash: string;
  readonly bundleId: Id<"tryoutRuntimeBundles">;
  readonly placement: Doc<"tryoutPlacements">;
  readonly snapshotId: string;
}

/** Seeds one current signed attempt that cleanup must never mutate. */
export async function seedTarget(ctx: MutationCtx): Promise<CleanupTarget> {
  const seeded = await seedTryoutContentAccessState(ctx, {
    attemptStatus: "completed",
    sectionStatus: "completed",
    suffix: "migration-cleanup",
  });
  const attempt = await ctx.db.get(seeded.attemptId);
  assert.ok(
    attempt?.tryoutBundleHash && attempt.tryoutBundleId,
    "Expected one permanent target runtime fixture."
  );
  const placement = await ctx.db
    .query("tryoutPlacements")
    .withIndex("by_snapshotId_and_index", (query) =>
      query.eq("snapshotId", attempt.tryoutSnapshotId)
    )
    .first();
  assert.ok(placement, "Expected one permanent target placement fixture.");
  return {
    attemptId: attempt._id,
    bundleHash: attempt.tryoutBundleHash,
    bundleId: attempt.tryoutBundleId,
    placement,
    snapshotId: attempt.tryoutSnapshotId,
  };
}
