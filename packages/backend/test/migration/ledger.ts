import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type {
  SourceScale,
  TargetScale,
} from "@repo/backend/test/migration/source";
import {
  CLEANUP_MIGRATION_ID,
  CLEANUP_ORPHAN_ARTIFACT,
  CLEANUP_SHARED_ARTIFACT,
} from "@repo/backend/test/migration/state";

/** Seeds temporary maps and scale audit facts deleted after source cleanup. */
export async function seedLedger(
  ctx: MutationCtx,
  scales: readonly {
    readonly source: SourceScale;
    readonly target: TargetScale;
  }[],
  targetPlacementRowHash: string
) {
  await ctx.db.insert("tryoutHistoryMigrationMaps", {
    identity: CLEANUP_SHARED_ARTIFACT,
    index: 0,
    kind: "artifact",
    migrationId: CLEANUP_MIGRATION_ID,
    newHash: "target-shared-artifact",
    oldHash: CLEANUP_SHARED_ARTIFACT,
    targetCreated: false,
  });
  await ctx.db.insert("tryoutHistoryMigrationMaps", {
    identity: CLEANUP_ORPHAN_ARTIFACT,
    index: 1,
    kind: "artifact",
    migrationId: CLEANUP_MIGRATION_ID,
    newHash: "target-orphan-artifact",
    oldHash: CLEANUP_ORPHAN_ARTIFACT,
    targetCreated: false,
  });
  await ctx.db.insert("tryoutHistoryMigrationMaps", {
    identity: "catalog-identity",
    index: 0,
    kind: "catalog",
    migrationId: CLEANUP_MIGRATION_ID,
    newHash: "catalog-target",
    oldHash: "catalog-source",
    targetCreated: false,
  });
  await ctx.db.insert("tryoutHistoryMigrationMaps", {
    identity: "source-placement",
    index: 0,
    kind: "placement",
    migrationId: CLEANUP_MIGRATION_ID,
    newHash: targetPlacementRowHash,
    oldHash: "source-placement",
    targetCreated: false,
  });
  for (const { source, target } of scales) {
    await ctx.db.insert("tryoutHistoryScaleMigrations", {
      migrationId: CLEANUP_MIGRATION_ID,
      newScaleVersionId: target.scaleVersionId,
      oldScaleVersionId: source.scaleVersionId,
      runMappings: [{ newRunId: target.runId, oldRunId: source.runId }],
    });
  }
}
