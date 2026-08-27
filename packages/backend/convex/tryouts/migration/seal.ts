import { canonicalizeSignedTryoutHistoryMigrationReceipt } from "@nakafa/aksara-contracts/migration/tryout/history/canonical";
import { SignedTryoutHistoryMigrationReceiptSchema } from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { migrationReceiptRecordValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import {
  loadMigrationReceipt,
  loadTryoutHistoryMigration,
  migrationReceiptRecord,
} from "@repo/backend/convex/tryouts/migration/state/store";
import { v } from "convex/values";
import { Clock, Effect, Schema } from "effect";

/** Strictly decodes the canonical receipt bytes authenticated by Node ingress. */
const decodeReceipt = Effect.fn("tryouts.migration.decodeReceipt")(
  (receiptJson: string) =>
    parseStoredJson(receiptJson, "Try-out history migration receipt").pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(SignedTryoutHistoryMigrationReceiptSchema, {
          onExcessProperty: "error",
        })
      ),
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message:
              "Try-out history migration receipt violates its wire contract.",
          })
      )
    )
);

/** Checks one stored row is byte-for-byte identical to a verified retry. */
function hasSameReceipt(
  stored: ReturnType<typeof migrationReceiptRecord>,
  receiptJson: string
) {
  return stored.receiptJson === receiptJson;
}

/** Persists one exact terminal receipt before cleanup can remove any legacy row. */
const sealProgram = Effect.fn("tryouts.migration.seal")(function* (
  ctx: MutationCtx,
  receiptJson: string
) {
  const receipt = yield* decodeReceipt(receiptJson);
  if (
    canonicalizeSignedTryoutHistoryMigrationReceipt(receipt) !== receiptJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration receipt is not canonical."
    );
  }
  const migrationId = receipt.payload.migrationId;
  const existing = yield* loadMigrationReceipt(ctx, migrationId);
  if (existing) {
    const record = migrationReceiptRecord(existing);
    if (!hasSameReceipt(record, receiptJson)) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        `Try-out history migration ${migrationId} already owns another receipt.`
      );
    }
    return record;
  }
  const other = yield* Effect.promise(() =>
    ctx.db.query("tryoutHistoryMigrationReceipts").take(1)
  );
  if (other[0]) {
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Try-out history migration ${other[0].migrationId} already owns the permanent receipt.`
    );
  }
  const migration = yield* loadTryoutHistoryMigration(ctx, migrationId);
  const completion = receipt.payload.completion;
  if (
    migration.phase !== "completed" ||
    migration.authorization.planHash !== receipt.payload.planHash ||
    migration.sourceSnapshotId !== receipt.payload.sourceSnapshotId ||
    migration.target.bundleHash !== receipt.payload.targetBundleHash ||
    migration.target.snapshotId !== receipt.payload.targetSnapshotId ||
    migration.completion.cleanupLimit !== completion.cleanupLimit ||
    migration.completion.completedAt !== completion.completedAt ||
    migration.completion.migratedAttempts !== completion.migratedAttempts ||
    migration.completion.migratedScaleItems !== completion.migratedScaleItems ||
    migration.completion.migratedScaleRuns !== completion.migratedScaleRuns ||
    migration.completion.migratedScaleVersions !==
      completion.migratedScaleVersions
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration receipt differs from terminal storage."
    );
  }
  const recordedAt = yield* Clock.currentTimeMillis;
  const id = yield* Effect.promise(() =>
    ctx.db.insert("tryoutHistoryMigrationReceipts", {
      cleanupLimit: completion.cleanupLimit,
      completedAt: completion.completedAt,
      deletedRows: 0,
      migratedAttempts: completion.migratedAttempts,
      migratedScaleItems: completion.migratedScaleItems,
      migratedScaleRuns: completion.migratedScaleRuns,
      migratedScaleVersions: completion.migratedScaleVersions,
      migrationId,
      phase: "sealed",
      planHash: receipt.payload.planHash,
      receiptHash: receipt.receiptHash,
      receiptJson,
      recordedAt,
      sourceSnapshotId: receipt.payload.sourceSnapshotId,
      targetBundleHash: receipt.payload.targetBundleHash,
      targetSnapshotId: receipt.payload.targetSnapshotId,
    })
  );
  const stored = yield* Effect.promise(() => ctx.db.get(id));
  if (!stored) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Stored try-out history migration receipt disappeared."
    );
  }
  return migrationReceiptRecord(stored);
});

export const seal = internalMutation({
  args: { receiptJson: v.string() },
  returns: migrationReceiptRecordValidator,
  handler: (ctx, args) => runConvexProgram(sealProgram(ctx, args.receiptJson)),
});
