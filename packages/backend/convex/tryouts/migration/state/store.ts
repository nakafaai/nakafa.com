import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import {
  internalMutation,
  internalQuery,
} from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import {
  type activeMigrationStatusValidator,
  type completedMigrationStatusValidator,
  migrationRecordValidator,
  migrationStatusValidator,
} from "@repo/backend/convex/tryouts/migration/state/schema";
import { type Infer, v } from "convex/values";
import { Clock, Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type ActiveMigrationStatus = Infer<typeof activeMigrationStatusValidator>;
type CompletedMigrationStatus = Infer<typeof completedMigrationStatusValidator>;

/** Projects immutable completion facts shared by completed and cleaning roots. */
export function completedMigrationStatus(
  migration: Extract<
    Doc<"tryoutHistoryMigrations">,
    { readonly phase: "cleaning" | "completed" }
  >
): CompletedMigrationStatus {
  return {
    artifactMapCount: migration.artifactMapCount,
    catalogMapCount: migration.catalogMapCount,
    completion: {
      ...migration.completion,
      remainingMarkers: 0,
    },
    migrationId: migration.migrationId,
    phase: "completed",
    placementMapCount: migration.placementMapCount,
    planHash: migration.authorization.planHash,
    sourceSnapshotId: migration.sourceSnapshotId,
    targetBundleHash: migration.target.bundleHash,
    targetSnapshotId: migration.target.snapshotId,
  };
}

/** Loads one exact temporary migration root or fails closed. */
export const loadTryoutHistoryMigration = Effect.fn(
  "tryouts.migration.loadMigration"
)(function* (ctx: ReadCtx, migrationId: string) {
  const migration = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryMigrations")
      .withIndex("by_migrationId", (query) =>
        query.eq("migrationId", migrationId)
      )
      .unique()
  );
  if (!migration) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      `Try-out history migration ${migrationId} does not exist.`
    );
  }
  return migration;
});

/** Loads the permanent signed receipt when this migration was sealed. */
export const loadMigrationReceipt = Effect.fn("tryouts.migration.loadReceipt")(
  function* (ctx: ReadCtx, migrationId: string) {
    return yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrationReceipts")
        .withIndex("by_migrationId", (query) =>
          query.eq("migrationId", migrationId)
        )
        .unique()
    );
  }
);

/** Projects one temporary root into the public-safe status contract. */
export function migrationStatus(
  migration: Doc<"tryoutHistoryMigrations">
): ActiveMigrationStatus {
  const base = {
    artifactMapCount: migration.artifactMapCount,
    catalogMapCount: migration.catalogMapCount,
    migrationId: migration.migrationId,
    placementMapCount: migration.placementMapCount,
    sourceSnapshotId: migration.sourceSnapshotId,
  };
  if (migration.phase === "staging") {
    return { ...base, phase: "staging" };
  }
  if (migration.phase === "aborting") {
    return { ...base, deleted: migration.abort.deleted, phase: "aborting" };
  }
  const authorized = {
    ...base,
    planHash: migration.authorization.planHash,
    targetBundleHash: migration.target.bundleHash,
    targetSnapshotId: migration.target.snapshotId,
  };
  if (migration.phase === "ready") {
    return { ...authorized, phase: "ready" };
  }
  if (migration.phase === "running") {
    return { ...authorized, phase: "running" };
  }
  return completedMigrationStatus(migration);
}

/** Projects the receipt row without exposing Convex system fields. */
export function migrationReceiptRecord(
  receipt: Doc<"tryoutHistoryMigrationReceipts">
) {
  return {
    cleanupLimit: receipt.cleanupLimit,
    completedAt: receipt.completedAt,
    deletedRows: receipt.deletedRows,
    migratedAttempts: receipt.migratedAttempts,
    migratedScaleItems: receipt.migratedScaleItems,
    migratedScaleRuns: receipt.migratedScaleRuns,
    migratedScaleVersions: receipt.migratedScaleVersions,
    migrationId: receipt.migrationId,
    phase: receipt.phase,
    planHash: receipt.planHash,
    proof: receipt.proof ?? null,
    repair: receipt.repair ?? null,
    receiptHash: receipt.receiptHash,
    receiptJson: receipt.receiptJson,
    sourceSnapshotId: receipt.sourceSnapshotId,
    targetBundleHash: receipt.targetBundleHash,
    targetSnapshotId: receipt.targetSnapshotId,
  };
}

/** Creates or idempotently resumes the sole audited source migration. */
const initializeProgram = Effect.fn("tryouts.migration.initialize")(function* (
  ctx: MutationCtx,
  migrationId: string,
  sourceSnapshotId: string
) {
  const now = yield* Clock.currentTimeMillis;
  if (sourceSnapshotId !== retainedTryoutHistoryPlan.snapshotId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration selected an unaudited source snapshot."
    );
  }
  const [existing, receipts, tombstones] = yield* Effect.all([
    Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryMigrations")
        .withIndex("by_migrationId", (query) =>
          query.eq("migrationId", migrationId)
        )
        .unique()
    ),
    Effect.promise(() =>
      ctx.db.query("tryoutHistoryMigrationReceipts").take(1)
    ),
    Effect.promise(() => ctx.db.query("tryoutHistoryMigrationAborts").take(2)),
  ]);
  if (receipts[0]) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Try-out history migration ${receipts[0].migrationId} already owns a permanent receipt.`
    );
  }
  if (tombstones.length > 1) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "More than one try-out history abort tombstone exists."
    );
  }
  const tombstone = tombstones[0];
  if (existing && tombstone) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      `Try-out history migration ${migrationId} has both a root and abort tombstone.`
    );
  }
  if (existing) {
    if (existing.sourceSnapshotId !== sourceSnapshotId) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Try-out history migration ${migrationId} changed its source snapshot.`
      );
    }
    return migrationStatus(existing);
  }
  if (tombstone) {
    if (
      tombstone.migrationId !== migrationId ||
      tombstone.sourceSnapshotId !== sourceSnapshotId
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Try-out history migration ${migrationId} does not own the prior abort tombstone.`
      );
    }
    yield* Effect.promise(() =>
      ctx.db.delete("tryoutHistoryMigrationAborts", tombstone._id)
    );
  }
  const other = yield* Effect.promise(() =>
    ctx.db.query("tryoutHistoryMigrations").take(1)
  );
  if (other[0]) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Try-out history migration ${other[0].migrationId} already owns staging.`
    );
  }
  const id = yield* Effect.promise(() =>
    ctx.db.insert("tryoutHistoryMigrations", {
      artifactMapCount: 0,
      catalogMapCount: 0,
      createdAt: now,
      migrationId,
      phase: "staging",
      placementMapCount: 0,
      sourceSnapshotId,
      target: { kind: "pending" },
      updatedAt: now,
    })
  );
  const created = yield* Effect.promise(() => ctx.db.get(id));
  if (!created) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Created try-out migration disappeared."
    );
  }
  return migrationStatus(created);
});

export const initialize = internalMutation({
  args: { migrationId: v.string(), sourceSnapshotId: v.string() },
  returns: migrationStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      initializeProgram(ctx, args.migrationId, args.sourceSnapshotId)
    ),
});

export const record = internalQuery({
  args: { migrationId: v.string() },
  returns: migrationRecordValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.all({
        migration: Effect.promise(() =>
          ctx.db
            .query("tryoutHistoryMigrations")
            .withIndex("by_migrationId", (query) =>
              query.eq("migrationId", args.migrationId)
            )
            .unique()
        ),
        receipt: loadMigrationReceipt(ctx, args.migrationId),
      }).pipe(
        Effect.map(({ migration, receipt }) => ({
          cleanupStarted: migration?.phase === "cleaning",
          receipt: receipt ? migrationReceiptRecord(receipt) : null,
          status: migration ? migrationStatus(migration) : null,
        }))
      )
    ),
});
