import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  countCleanupRows,
  initialCleanupState,
  recordCleanupPage,
  requireCleanupComplete,
} from "@repo/backend/convex/tryouts/migration/cleanup/count";
import {
  hasCleanupReceiptBinding,
  hasSameCleanupProof,
  requireCleanupPlan,
  requireCleanupPreconditions,
} from "@repo/backend/convex/tryouts/migration/cleanup/guard";
import { cleanupLedger } from "@repo/backend/convex/tryouts/migration/cleanup/ledger";
import { requireCleanupEmpty } from "@repo/backend/convex/tryouts/migration/cleanup/proof";
import { cleanupScale } from "@repo/backend/convex/tryouts/migration/cleanup/scale";
import {
  type CleanupProof,
  type CleanupState,
  cleanupProofValidator,
} from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { cleanupSource } from "@repo/backend/convex/tryouts/migration/cleanup/source";
import { loadMigrationReceipt } from "@repo/backend/convex/tryouts/migration/state/store";
import { verifyTerminalStorage } from "@repo/backend/convex/tryouts/migration/terminal";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

/** Progress from one bounded cleanup transaction. */
export const cleanupResultValidator = v.object({
  deleted: v.number(),
  done: v.boolean(),
});

/** Deletes one bounded legacy page and removes the temporary root last. */
export const cleanupProgram = Effect.fn("tryouts.migration.cleanup")(function* (
  ctx: MutationCtx,
  migrationId: string,
  receiptHash: string,
  proof: CleanupProof
) {
  const receipt = yield* loadMigrationReceipt(ctx, migrationId);
  if (!receipt || receipt.receiptHash !== receiptHash) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup has no matching permanent signed receipt."
    );
  }
  const migration = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryMigrations")
      .withIndex("by_migrationId", (query) =>
        query.eq("migrationId", migrationId)
      )
      .unique()
  );
  if (!migration) {
    if (
      receipt.phase === "cleaned" &&
      receipt.proof &&
      hasSameCleanupProof(receipt.proof, proof) &&
      Number.isSafeInteger(receipt.deletedRows) &&
      receipt.deletedRows > 0 &&
      receipt.deletedRows <= receipt.cleanupLimit
    ) {
      return { deleted: 0, done: true };
    }
    if (receipt.phase === "cleaned") {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Cleaned try-out history migration lost its durable cleanup proof."
      );
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Sealed try-out history migration lost its root before terminal cleanup."
    );
  }
  if (receipt.phase !== "sealed") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Cleaned try-out history migration still retains temporary state."
    );
  }
  if (
    (migration.phase !== "completed" && migration.phase !== "cleaning") ||
    !hasCleanupReceiptBinding(migration, receipt)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup lost its signed terminal binding."
    );
  }
  if (
    !Number.isSafeInteger(receipt.deletedRows) ||
    receipt.deletedRows < 0 ||
    receipt.deletedRows > receipt.cleanupLimit
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup has an invalid cumulative deletion count."
    );
  }
  const plan = yield* requireCleanupPlan(migration);
  yield* requireCleanupPreconditions(ctx, migration);
  let state: CleanupState;
  if (migration.phase === "completed") {
    if (receipt.proof || receipt.deletedRows !== 0) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Unstarted try-out history cleanup already has durable progress."
      );
    }
    yield* verifyTerminalStorage(ctx, migration);
    state = initialCleanupState(yield* Clock.currentTimeMillis);
  } else {
    if (!(receipt.proof && hasSameCleanupProof(receipt.proof, proof))) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history cleanup proof changed after deletion started."
      );
    }
    state = migration.cleanup;
  }
  const countedRows = yield* countCleanupRows(state, plan.payload);
  if (countedRows !== receipt.deletedRows) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup counter differs from durable progress."
    );
  }
  const scale = yield* cleanupScale(ctx, migration);
  const source = scale === null ? yield* cleanupSource(ctx, migration) : null;
  const ledger =
    scale === null && source === null
      ? yield* cleanupLedger(ctx, migrationId)
      : null;
  const page = scale ?? source ?? ledger;
  if (page) {
    const nextState = yield* recordCleanupPage(state, plan.payload, page);
    const deletedRows = receipt.deletedRows + page.deleted;
    const nextCount = yield* countCleanupRows(nextState, plan.payload);
    if (
      !Number.isSafeInteger(deletedRows) ||
      deletedRows !== nextCount ||
      deletedRows > receipt.cleanupLimit
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history cleanup exceeded its signed deletion ceiling."
      );
    }
    const updatedAt = yield* Clock.currentTimeMillis;
    if (migration.phase === "completed") {
      yield* Effect.promise(() =>
        ctx.db.replace("tryoutHistoryMigrations", migration._id, {
          artifactMapCount: migration.artifactMapCount,
          authorization: migration.authorization,
          catalogMapCount: migration.catalogMapCount,
          cleanup: nextState,
          completion: migration.completion,
          createdAt: migration.createdAt,
          migrationId: migration.migrationId,
          phase: "cleaning",
          placementMapCount: migration.placementMapCount,
          sourceSnapshotId: migration.sourceSnapshotId,
          target: migration.target,
          updatedAt,
        })
      );
    } else {
      yield* Effect.promise(() =>
        ctx.db.patch("tryoutHistoryMigrations", migration._id, {
          cleanup: nextState,
          updatedAt,
        })
      );
    }
    yield* Effect.promise(() =>
      ctx.db.patch("tryoutHistoryMigrationReceipts", receipt._id, {
        deletedRows,
        proof,
      })
    );
    return { deleted: page.deleted, done: false };
  }
  yield* requireCleanupEmpty(ctx, migration);
  const deletedRows = yield* requireCleanupComplete(state, plan.payload);
  if (deletedRows !== receipt.deletedRows) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup terminal count changed before root deletion."
    );
  }
  const terminalDeletedRows = deletedRows + 1;
  if (
    !Number.isSafeInteger(terminalDeletedRows) ||
    terminalDeletedRows > receipt.cleanupLimit
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup root exceeds its signed deletion ceiling."
    );
  }
  yield* Effect.promise(() =>
    ctx.db.patch("tryoutHistoryMigrationReceipts", receipt._id, {
      deletedRows: terminalDeletedRows,
      phase: "cleaned",
      proof,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.delete("tryoutHistoryMigrations", migration._id)
  );
  return { deleted: 1, done: true };
});

export const cleanup = internalMutation({
  args: {
    migrationId: v.string(),
    proof: cleanupProofValidator,
    receiptHash: v.string(),
  },
  returns: cleanupResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      cleanupProgram(ctx, args.migrationId, args.receiptHash, args.proof)
    ),
});
