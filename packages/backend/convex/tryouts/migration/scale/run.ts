import type { TryoutHistoryMigrationScaleInventory } from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import {
  createScaleClone,
  verifyScaleClone,
} from "@repo/backend/convex/tryouts/migration/scale/clone";
import { verifyTryoutHistoryScaleInventory } from "@repo/backend/convex/tryouts/migration/scale/inventory";
import { Effect } from "effect";
/** Reuses or creates one clone after rechecking every signed source graph. */
export const migrateTryoutHistoryScale = Effect.fn(
  "tryouts.migration.migrateScale"
)(function* (
  ctx: MutationCtx,
  migrationId: string,
  oldScaleVersionId: Id<"irtScaleVersions">,
  sourceScaleVersionIds: readonly Id<"irtScaleVersions">[],
  sourceEvidence: TryoutHistoryMigrationScaleInventory,
  targetSnapshotId: string
) {
  const inventory = yield* verifyTryoutHistoryScaleInventory(
    ctx,
    sourceScaleVersionIds,
    sourceEvidence
  );
  const source = inventory.graphs.find(
    ({ scale }) => scale._id === oldScaleVersionId
  );
  if (!source) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained attempt selected an unauthorized IRT scale."
    );
  }
  const existing = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryScaleMigrations")
      .withIndex("by_migrationId_and_oldScaleVersionId", (query) =>
        query
          .eq("migrationId", migrationId)
          .eq("oldScaleVersionId", oldScaleVersionId)
      )
      .unique()
  );
  return existing
    ? yield* verifyScaleClone(
        ctx,
        migrationId,
        source,
        existing,
        targetSnapshotId
      )
    : yield* createScaleClone(ctx, migrationId, source, targetSnapshotId);
});
