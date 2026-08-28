import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type schema from "@repo/backend/convex/schema";
import type { TestConvex } from "convex-test";

export const CLEANUP_MIGRATION_ID = "migration-cleanup-test";
export const CLEANUP_RECEIPT_HASH = `sha256:${"9".repeat(64)}`;
export const CLEANUP_SOURCE_SNAPSHOT = `sha256:${"1".repeat(64)}`;
export const CLEANUP_SHARED_ARTIFACT = "artifact-cleanup-shared";
export const CLEANUP_ORPHAN_ARTIFACT = "artifact-cleanup-orphan";
export const CLEANUP_LIMIT = 87;
export const CLEANUP_SOURCE_INVENTORY = {
  catalogRowCount: 33,
  placementRowCount: 1,
} as const;
export const CLEANUP_PROOF = {
  assetHash: `sha256:${"a".repeat(64)}`,
  sourceSha: "b".repeat(40),
} as const;

export type CleanupTest = TestConvex<typeof schema>;
export interface CleanupSourceInventory {
  readonly catalogRowCount: number;
  readonly placementRowCount: number;
}

/** Captures every cleanup-owned table for before-and-after guard proof. */
export function readCleanupState(t: CleanupTest) {
  return t.query(async (ctx) => ({
    artifacts: await ctx.db.query("contentArtifacts").collect(),
    attempts: await ctx.db.query("tryoutAttempts").collect(),
    audits: await ctx.db.query("tryoutHistoryAttemptMigrationAudits").collect(),
    history: await ctx.db.query("tryoutHistoryRows").collect(),
    maps: await ctx.db.query("tryoutHistoryMigrationMaps").collect(),
    migrations: await ctx.db.query("tryoutHistoryMigrations").collect(),
    observers: await ctx.db.query("contentPredecessorReads").collect(),
    receipts: await ctx.db.query("tryoutHistoryMigrationReceipts").collect(),
    runtimes: await ctx.db.query("tryoutRuntimeBundles").collect(),
    scales: await ctx.db.query("irtScaleVersions").collect(),
    scores: await ctx.db.query("tryoutScores").collect(),
    snapshots: await ctx.db.query("contentSnapshots").collect(),
  }));
}

interface CleanupResultIds {
  readonly sourceScaleId: Id<"irtScaleVersions">;
  readonly targetAttemptId: Id<"tryoutAttempts">;
  readonly targetBundleId: Id<"tryoutRuntimeBundles">;
  readonly targetPlacementId: Id<"tryoutPlacements">;
  readonly targetRunId: Id<"irtCalibrationRuns">;
  readonly targetScaleId: Id<"irtScaleVersions">;
  readonly targetSnapshotId: string;
}

/** Reads final source absence and permanent target preservation together. */
export function readCleanupResult(t: CleanupTest, ids: CleanupResultIds) {
  return t.query(async (ctx) => ({
    attempt: await ctx.db.get(ids.targetAttemptId),
    audits: await ctx.db.query("tryoutHistoryAttemptMigrationAudits").collect(),
    legacy: await ctx.db
      .query("tryoutBundles")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .collect(),
    maps: await ctx.db.query("tryoutHistoryMigrationMaps").collect(),
    migration: await ctx.db.query("tryoutHistoryMigrations").unique(),
    orphanArtifact: await ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash", (query) =>
        query.eq("artifactHash", CLEANUP_ORPHAN_ARTIFACT)
      )
      .unique(),
    observers: await ctx.db.query("contentPredecessorReads").collect(),
    receipt: await ctx.db.query("tryoutHistoryMigrationReceipts").unique(),
    scaleMaps: await ctx.db.query("tryoutHistoryScaleMigrations").collect(),
    sharedArtifact: await ctx.db
      .query("contentArtifacts")
      .withIndex("by_artifactHash", (query) =>
        query.eq("artifactHash", CLEANUP_SHARED_ARTIFACT)
      )
      .unique(),
    sourceCatalog: await ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .collect(),
    sourceHistory: await ctx.db
      .query("tryoutHistoryRows")
      .withIndex("by_snapshotId_and_rowKind_and_index", (query) =>
        query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .collect(),
    sourceItems: await ctx.db
      .query("irtScaleItems")
      .withIndex("by_scaleVersionId_and_placementIdentity", (query) =>
        query.eq("scaleVersionId", ids.sourceScaleId)
      )
      .collect(),
    sourcePlacements: await ctx.db
      .query("tryoutPlacements")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .collect(),
    sourceRuns: await ctx.db
      .query("irtCalibrationRuns")
      .withIndex(
        "by_scaleVersionId_and_sectionIdentity_and_startedAt",
        (query) => query.eq("scaleVersionId", ids.sourceScaleId)
      )
      .collect(),
    sourceRuntime: await ctx.db
      .query("tryoutRuntimeBundles")
      .withIndex("by_snapshotId_and_rendererManifestHash", (query) =>
        query.eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .collect(),
    sourceScale: await ctx.db.get(ids.sourceScaleId),
    sourceSnapshot: await ctx.db
      .query("contentSnapshots")
      .withIndex("by_family_and_snapshotId", (query) =>
        query.eq("family", "tryout").eq("snapshotId", CLEANUP_SOURCE_SNAPSHOT)
      )
      .unique(),
    targetBundle: await ctx.db.get(ids.targetBundleId),
    targetCatalog: await ctx.db
      .query("tryoutCatalog")
      .withIndex("by_snapshotId_and_index", (query) =>
        query.eq("snapshotId", ids.targetSnapshotId)
      )
      .collect(),
    targetPlacement: await ctx.db.get(ids.targetPlacementId),
    targetRun: await ctx.db.get(ids.targetRunId),
    targetScale: await ctx.db.get(ids.targetScaleId),
  }));
}
