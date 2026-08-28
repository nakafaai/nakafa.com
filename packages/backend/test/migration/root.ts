import { strict as assert } from "node:assert/strict";
import { canonicalizeSignedTryoutHistoryMigrationPlan } from "@nakafa/aksara-contracts/migration/tryout/history/canonical";
import { computeTryoutHistoryCleanupLimit } from "@nakafa/aksara-contracts/migration/tryout/history/cleanup";
import { hashTryoutHistoryMigrationPlan } from "@nakafa/aksara-contracts/migration/tryout/history/hash";
import {
  SignedTryoutHistoryMigrationPlanSchema,
  TryoutHistoryMigrationPlanPayloadSchema,
} from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import {
  CLEANUP_LIMIT,
  CLEANUP_MIGRATION_ID,
  CLEANUP_RECEIPT_HASH,
  CLEANUP_SOURCE_INVENTORY,
  CLEANUP_SOURCE_SNAPSHOT,
  type CleanupSourceInventory,
} from "@repo/backend/test/migration/state";
import type { CleanupTarget } from "@repo/backend/test/migration/target";
import { Effect, Schema } from "effect";

const digest = (digit: string) => `sha256:${digit.repeat(64)}`;

/** Builds the exact signed-plan shape rehashed by native cleanup code. */
async function makeCleanupPlan(
  target: CleanupTarget,
  scaleVersionCount: number,
  sourceInventory: CleanupSourceInventory
) {
  const payload = Schema.decodeSync(TryoutHistoryMigrationPlanPayloadSchema)({
    format: "signed-tryout-history-migration-plan",
    migrationId: CLEANUP_MIGRATION_ID,
    source: {
      artifactCount: 2,
      attempts: {
        attemptCount: 1,
        digest: digest("2"),
        frozenPlacementCount: 1,
        progressCount: 1,
        responseCount: 1,
        scoreCount: 1,
        sectionAttemptCount: 1,
      },
      catalogRowCount: sourceInventory.catalogRowCount,
      creatingReleaseId: "source-release",
      legacyBundleCount: 1,
      placementRowCount: sourceInventory.placementRowCount,
      releases: [
        {
          attemptCount: 1,
          manifestHash: digest("3"),
          releaseId: "source-release",
        },
      ],
      rendererManifestHash: digest("4"),
      runtimeBundleCount: 1,
      scales: {
        digest: digest("5"),
        itemCount: scaleVersionCount,
        runCount: scaleVersionCount,
        versionCount: scaleVersionCount,
      },
      snapshot: {
        catalogDigest: digest("6"),
        counts: { country: 1, exam: 1, section: 1, set: 1, track: 1 },
        format: "tryout-v1",
        locales: ["en", "id"],
        placementCount: sourceInventory.placementRowCount,
        placementDigest: digest("7"),
        routeCount: 1,
        snapshotId: CLEANUP_SOURCE_SNAPSHOT,
      },
    },
    target: {
      artifacts: { count: 2, digest: digest("8") },
      bundleHash: target.bundleHash,
      catalog: { count: 1, digest: digest("a") },
      placements: { count: 1, digest: digest("b") },
      snapshot: {
        activeAppLocales: ["id"],
        catalogDigest: digest("c"),
        counts: { country: 1, exam: 1, section: 1, set: 1, track: 1 },
        format: "localized-tryout-snapshot",
        placementCount: 1,
        placementDigest: digest("d"),
        routeCount: 1,
        snapshotId: target.snapshotId,
      },
    },
  });
  const planHash = await Effect.runPromise(
    hashTryoutHistoryMigrationPlan(payload)
  );
  const plan = Schema.decodeSync(SignedTryoutHistoryMigrationPlanSchema)({
    keyId: "cleanup-test",
    payload,
    planHash,
    signature: "A".repeat(86),
  });
  const cleanupLimit = await Effect.runPromise(
    computeTryoutHistoryCleanupLimit(payload)
  );
  if (
    scaleVersionCount === 1 &&
    sourceInventory.catalogRowCount ===
      CLEANUP_SOURCE_INVENTORY.catalogRowCount &&
    sourceInventory.placementRowCount ===
      CLEANUP_SOURCE_INVENTORY.placementRowCount
  ) {
    assert.equal(cleanupLimit, CLEANUP_LIMIT);
  }
  return {
    cleanupLimit,
    plan,
    planJson: canonicalizeSignedTryoutHistoryMigrationPlan(plan),
  };
}

/** Inserts the completed root and externally preservable receipt row. */
export async function seedRoot(
  ctx: MutationCtx,
  target: CleanupTarget,
  sourceScaleVersionIds: readonly Id<"irtScaleVersions">[],
  sourceInventory: CleanupSourceInventory = CLEANUP_SOURCE_INVENTORY
) {
  const signed = await makeCleanupPlan(
    target,
    sourceScaleVersionIds.length,
    sourceInventory
  );
  const completion = {
    cleanupLimit: signed.cleanupLimit,
    completedAt: 10,
    migratedAttempts: 1,
    migratedScaleItems: sourceScaleVersionIds.length,
    migratedScaleRuns: sourceScaleVersionIds.length,
    migratedScaleVersions: sourceScaleVersionIds.length,
  };
  await ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 2,
    authorization: {
      planHash: signed.plan.planHash,
      planJson: signed.planJson,
      sourceScaleVersionIds: [...sourceScaleVersionIds],
    },
    catalogMapCount: 1,
    completion,
    createdAt: 1,
    migrationId: CLEANUP_MIGRATION_ID,
    phase: "completed",
    placementMapCount: 1,
    sourceSnapshotId: CLEANUP_SOURCE_SNAPSHOT,
    target: {
      bundleCreated: false,
      bundleHash: target.bundleHash,
      kind: "staged",
      snapshotCreated: false,
      snapshotId: target.snapshotId,
    },
    updatedAt: 10,
  });
  await ctx.db.insert("tryoutHistoryMigrationReceipts", {
    ...completion,
    deletedRows: 0,
    migrationId: CLEANUP_MIGRATION_ID,
    phase: "sealed",
    planHash: signed.plan.planHash,
    receiptHash: CLEANUP_RECEIPT_HASH,
    receiptJson: "signed-receipt-cleanup-test",
    recordedAt: 11,
    sourceSnapshotId: CLEANUP_SOURCE_SNAPSHOT,
    targetBundleHash: target.bundleHash,
    targetSnapshotId: target.snapshotId,
  });
}
