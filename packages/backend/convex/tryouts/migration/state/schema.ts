import {
  cleanupProofValidator,
  cleanupRepairValidator,
} from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { v } from "convex/values";

export const completionValidator = v.object({
  cleanupLimit: v.number(),
  completedAt: v.number(),
  migratedAttempts: v.number(),
  migratedScaleItems: v.number(),
  migratedScaleRuns: v.number(),
  migratedScaleVersions: v.number(),
  remainingMarkers: v.literal(0),
});

const receiptValidator = v.object({
  keyId: v.string(),
  payload: v.object({
    completion: completionValidator,
    format: v.literal("signed-tryout-history-migration-receipt"),
    migrationId: v.string(),
    planHash: v.string(),
    sourceSnapshotId: v.string(),
    targetBundleHash: v.string(),
    targetSnapshotId: v.string(),
  }),
  receiptHash: v.string(),
  signature: v.string(),
});

const statusFields = {
  artifactMapCount: v.number(),
  catalogMapCount: v.number(),
  migrationId: v.string(),
  placementMapCount: v.number(),
  sourceSnapshotId: v.string(),
};
const authorizationFields = {
  planHash: v.string(),
  targetBundleHash: v.string(),
  targetSnapshotId: v.string(),
};

/** Completed state admitted only after terminal storage revalidation. */
export const completedMigrationStatusValidator = v.object({
  ...statusFields,
  ...authorizationFields,
  completion: completionValidator,
  phase: v.literal("completed"),
});

/** Status phases backed directly by the temporary migration root. */
export const activeMigrationStatusValidator = v.union(
  v.object({ ...statusFields, phase: v.literal("staging") }),
  v.object({
    ...statusFields,
    deleted: v.number(),
    phase: v.literal("aborting"),
  }),
  v.object({
    ...statusFields,
    ...authorizationFields,
    phase: v.literal("ready"),
  }),
  v.object({
    ...statusFields,
    ...authorizationFields,
    phase: v.literal("running"),
  }),
  completedMigrationStatusValidator
);

/** Private terminal proof input used by Node integrity verification. */
export const terminalRecordValidator = v.object({
  planJson: v.string(),
  status: completedMigrationStatusValidator,
});

/** Public-safe migration lifecycle status. */
export const migrationStatusValidator = v.union(
  activeMigrationStatusValidator,
  v.object({
    ...statusFields,
    ...authorizationFields,
    completion: completionValidator,
    phase: v.literal("sealed"),
    receipt: receiptValidator,
  }),
  v.object({
    migrationId: v.string(),
    phase: v.literal("cleaned"),
    receipt: receiptValidator,
  })
);

/** Stored signed receipt facts needed by status and bounded cleanup. */
export const migrationReceiptRecordValidator = v.object({
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
  proof: v.union(cleanupProofValidator, v.null()),
  repair: v.union(cleanupRepairValidator, v.null()),
  receiptHash: v.string(),
  receiptJson: v.string(),
  sourceSnapshotId: v.string(),
  targetBundleHash: v.string(),
  targetSnapshotId: v.string(),
});

/** Durable cleanup facts read without exposing proof in public status. */
export const cleanupReceiptValidator = v.union(
  v.null(),
  v.object({
    deletedRows: v.number(),
    phase: v.union(v.literal("sealed"), v.literal("cleaned")),
    proof: v.union(cleanupProofValidator, v.null()),
    repair: v.union(cleanupRepairValidator, v.null()),
  })
);

/** Internal state read that distinguishes absent, sealed, and cleaned roots. */
export const migrationRecordValidator = v.object({
  cleanupStarted: v.boolean(),
  repairScalePresent: v.boolean(),
  receipt: v.union(migrationReceiptRecordValidator, v.null()),
  status: v.union(activeMigrationStatusValidator, v.null()),
});

/** Public migration mapping identity. */
export const mapEntryValidator = v.object({
  identity: v.string(),
  index: v.number(),
  kind: v.union(
    v.literal("artifact"),
    v.literal("catalog"),
    v.literal("placement")
  ),
  newHash: v.string(),
  oldHash: v.string(),
});

/** Staged immutable runtime bytes selected by one migration root. */
export const targetRuntimeValidator = v.union(
  v.null(),
  v.object({
    bundleJson: v.string(),
    rendererJson: v.string(),
  })
);

/** One staged target row in canonical index order. */
export const targetRowValidator = v.object({
  index: v.number(),
  rowHash: v.string(),
  rowJson: v.string(),
});
