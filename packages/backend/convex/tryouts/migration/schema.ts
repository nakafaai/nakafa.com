import {
  cleanupProofValidator,
  cleanupStateValidator,
} from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { defineTable } from "convex/server";
import { v } from "convex/values";

const migrationFields = {
  artifactMapCount: v.number(),
  catalogMapCount: v.number(),
  createdAt: v.number(),
  migrationId: v.string(),
  placementMapCount: v.number(),
  sourceSnapshotId: v.string(),
  updatedAt: v.number(),
};
const authorizationValidator = v.object({
  planHash: v.string(),
  planJson: v.string(),
  sourceScaleVersionIds: v.array(v.id("irtScaleVersions")),
});
const stagedTargetValidator = v.object({
  bundleCreated: v.boolean(),
  bundleHash: v.string(),
  kind: v.literal("staged"),
  snapshotCreated: v.boolean(),
  snapshotId: v.string(),
});
const progressValidator = v.object({
  migratedAttempts: v.number(),
  migratedScaleItems: v.number(),
  migratedScaleRuns: v.number(),
  migratedScaleVersions: v.number(),
});
const abortValidator = v.object({
  deleted: v.number(),
  maps: v.object({
    artifact: v.number(),
    catalog: v.number(),
    placement: v.number(),
  }),
});
const completionValidator = v.object({
  cleanupLimit: v.number(),
  completedAt: v.number(),
  migratedAttempts: v.number(),
  migratedScaleItems: v.number(),
  migratedScaleRuns: v.number(),
  migratedScaleVersions: v.number(),
});
const migrationValidator = v.union(
  v.object({
    ...migrationFields,
    phase: v.literal("staging"),
    target: v.union(
      v.object({ kind: v.literal("pending") }),
      stagedTargetValidator
    ),
  }),
  v.object({
    ...migrationFields,
    abort: abortValidator,
    phase: v.literal("aborting"),
    target: v.union(
      v.object({ kind: v.literal("pending") }),
      stagedTargetValidator
    ),
  }),
  v.object({
    ...migrationFields,
    authorization: authorizationValidator,
    phase: v.literal("ready"),
    target: stagedTargetValidator,
  }),
  v.object({
    ...migrationFields,
    authorization: authorizationValidator,
    phase: v.literal("running"),
    progress: progressValidator,
    target: stagedTargetValidator,
  }),
  v.object({
    ...migrationFields,
    authorization: authorizationValidator,
    completion: completionValidator,
    phase: v.literal("completed"),
    target: stagedTargetValidator,
  }),
  v.object({
    ...migrationFields,
    authorization: authorizationValidator,
    cleanup: cleanupStateValidator,
    completion: completionValidator,
    phase: v.literal("cleaning"),
    target: stagedTargetValidator,
  })
);

const tables = {
  /** Final retry evidence for one fully removed staging root. */
  tryoutHistoryMigrationAborts: defineTable({
    abortedAt: v.number(),
    deleted: v.number(),
    migrationId: v.string(),
    sourceSnapshotId: v.string(),
  }).index("by_migrationId", ["migrationId"]),

  /** Temporary per-attempt digest proven by the aggregate signed plan. */
  tryoutHistoryAttemptMigrationAudits: defineTable(
    v.union(
      v.object({
        migrationId: v.string(),
        phase: v.literal("pending"),
        sourceDigest: v.string(),
        tryoutAttemptId: v.id("tryoutAttempts"),
        tryoutAttemptHistoryId: v.id("tryoutAttemptHistory"),
        userId: v.id("users"),
      }),
      v.object({
        migrationId: v.string(),
        phase: v.literal("completed"),
        sourceDigest: v.string(),
        targetBundleHash: v.string(),
        targetScaleVersionId: v.optional(v.id("irtScaleVersions")),
        targetSnapshotId: v.string(),
        tryoutAttemptId: v.id("tryoutAttempts"),
        tryoutAttemptHistoryId: v.id("tryoutAttemptHistory"),
        userId: v.id("users"),
      })
    )
  )
    .index("by_migrationId_and_tryoutAttemptId", [
      "migrationId",
      "tryoutAttemptId",
    ])
    .index("by_tryoutAttemptId", ["tryoutAttemptId"])
    .index("by_userId", ["userId"]),

  /** Temporary root binding every staged byte to one signed migration plan. */
  tryoutHistoryMigrations: defineTable(migrationValidator)
    .index("by_migrationId", ["migrationId"])
    .index("by_source_snapshotId", ["sourceSnapshotId"])
    .index("by_target_snapshotId", ["target.snapshotId"]),

  /** Permanent public-safe receipt retained after all migration state is gone. */
  tryoutHistoryMigrationReceipts: defineTable({
    cleanupLimit: v.number(),
    completedAt: v.number(),
    deletedRows: v.number(),
    migratedAttempts: v.number(),
    migratedScaleItems: v.number(),
    migratedScaleRuns: v.number(),
    migratedScaleVersions: v.number(),
    migrationId: v.string(),
    phase: v.union(v.literal("sealed"), v.literal("cleaned")),
    planHash: v.string(),
    proof: v.optional(cleanupProofValidator),
    receiptHash: v.string(),
    receiptJson: v.string(),
    recordedAt: v.number(),
    sourceSnapshotId: v.string(),
    targetBundleHash: v.string(),
    targetSnapshotId: v.string(),
  }).index("by_migrationId", ["migrationId"]),

  /** Temporary normalized old-to-current content identity ledger. */
  tryoutHistoryMigrationMaps: defineTable({
    identity: v.string(),
    index: v.number(),
    kind: v.union(
      v.literal("artifact"),
      v.literal("catalog"),
      v.literal("placement")
    ),
    migrationId: v.string(),
    newHash: v.string(),
    oldHash: v.string(),
    targetCreated: v.boolean(),
  })
    .index("by_migrationId_and_kind_and_index", [
      "migrationId",
      "kind",
      "index",
    ])
    .index("by_migrationId_and_kind_and_oldHash", [
      "migrationId",
      "kind",
      "oldHash",
    ])
    .index("by_migrationId_and_kind_and_newHash", [
      "migrationId",
      "kind",
      "newHash",
    ]),

  /** Temporary idempotency map for historical IRT scale clones. */
  tryoutHistoryScaleMigrations: defineTable({
    migrationId: v.string(),
    newScaleVersionId: v.id("irtScaleVersions"),
    oldScaleVersionId: v.id("irtScaleVersions"),
    runMappings: v.array(
      v.object({
        newRunId: v.id("irtCalibrationRuns"),
        oldRunId: v.id("irtCalibrationRuns"),
      })
    ),
  }).index("by_migrationId_and_oldScaleVersionId", [
    "migrationId",
    "oldScaleVersionId",
  ]),
};

export default tables;
