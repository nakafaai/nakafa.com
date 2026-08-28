import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { requireSealedPredecessorObservation } from "@repo/backend/convex/contentRelease/predecessor/control";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { verifyTryoutHistoryAttemptInventory } from "@repo/backend/convex/tryouts/migration/attempt/inventory";
import { decodeMigrationPlan } from "@repo/backend/convex/tryouts/migration/plan";
import { verifyTryoutHistoryScaleInventory } from "@repo/backend/convex/tryouts/migration/scale/inventory";
import { migrationStatusValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import {
  loadTryoutHistoryMigration,
  migrationStatus,
} from "@repo/backend/convex/tryouts/migration/state/store";
import { verifyTerminalStorage } from "@repo/backend/convex/tryouts/migration/terminal";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

/** Atomically opens the signed plan for resumable one-attempt writes. */
const beginProgram = Effect.fn("tryouts.migration.begin")(function* (
  ctx: MutationCtx,
  migrationId: string
) {
  const now = yield* Clock.currentTimeMillis;
  const migration = yield* loadTryoutHistoryMigration(ctx, migrationId);
  if (migration.phase === "completed") {
    yield* verifyTerminalStorage(ctx, migration);
    return migrationStatus(migration);
  }
  if (migration.phase === "running") {
    yield* requireSealedPredecessorObservation(
      ctx,
      migration.predecessorObservationId
    );
    return migrationStatus(migration);
  }
  if (migration.phase !== "ready") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Try-out history migration has no authorized plan."
    );
  }
  const predecessorObservationId =
    yield* requireSealedPredecessorObservation(ctx);
  const plan = yield* decodeMigrationPlan(migration.authorization.planJson);
  if (
    plan.planHash !== migration.authorization.planHash ||
    plan.payload.migrationId !== migrationId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration lost its signed authorization."
    );
  }
  const audits = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryAttemptMigrationAudits")
      .withIndex("by_migrationId_and_tryoutAttemptId", (query) =>
        query.eq("migrationId", migrationId)
      )
      .take(plan.payload.source.attempts.attemptCount + 1)
  );
  if (
    audits.length !== plan.payload.source.attempts.attemptCount ||
    audits.some(({ phase }) => phase !== "pending")
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history attempt authorization is incomplete."
    );
  }
  yield* verifyTryoutHistoryAttemptInventory(ctx, plan.payload.source.attempts);
  yield* verifyTryoutHistoryScaleInventory(
    ctx,
    migration.authorization.sourceScaleVersionIds,
    plan.payload.source.scales
  );
  yield* Effect.promise(() =>
    ctx.db.replace("tryoutHistoryMigrations", migration._id, {
      artifactMapCount: migration.artifactMapCount,
      authorization: migration.authorization,
      catalogMapCount: migration.catalogMapCount,
      createdAt: migration.createdAt,
      migrationId,
      phase: "running",
      placementMapCount: migration.placementMapCount,
      predecessorObservationId,
      progress: {
        migratedAttempts: 0,
        migratedScaleItems: 0,
        migratedScaleRuns: 0,
        migratedScaleVersions: 0,
      },
      sourceSnapshotId: migration.sourceSnapshotId,
      target: migration.target,
      updatedAt: now,
    })
  );
  return migrationStatus(yield* loadTryoutHistoryMigration(ctx, migrationId));
});

/** Seals terminal aggregate evidence only after every marker is gone. */
const finalizeProgram = Effect.fn("tryouts.migration.finalize")(function* (
  ctx: MutationCtx,
  migrationId: string
) {
  const now = yield* Clock.currentTimeMillis;
  const migration = yield* loadTryoutHistoryMigration(ctx, migrationId);
  if (migration.phase === "completed") {
    yield* verifyTerminalStorage(ctx, migration);
    return migrationStatus(migration);
  }
  if (migration.phase !== "running") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Try-out history migration is not running."
    );
  }
  const { cleanupLimit } = yield* verifyTerminalStorage(ctx, migration);
  yield* Effect.promise(() =>
    ctx.db.replace("tryoutHistoryMigrations", migration._id, {
      artifactMapCount: migration.artifactMapCount,
      authorization: migration.authorization,
      catalogMapCount: migration.catalogMapCount,
      completion: {
        cleanupLimit,
        completedAt: now,
        ...migration.progress,
      },
      createdAt: migration.createdAt,
      migrationId,
      phase: "completed",
      placementMapCount: migration.placementMapCount,
      predecessorObservationId: migration.predecessorObservationId,
      sourceSnapshotId: migration.sourceSnapshotId,
      target: migration.target,
      updatedAt: now,
    })
  );
  const completed = yield* loadTryoutHistoryMigration(ctx, migrationId);
  if (completed.phase !== "completed") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history completion did not persist terminal state."
    );
  }
  yield* verifyTerminalStorage(ctx, completed);
  return migrationStatus(completed);
});

export const begin = internalMutation({
  args: { migrationId: v.string() },
  returns: migrationStatusValidator,
  handler: (ctx, args) => runConvexProgram(beginProgram(ctx, args.migrationId)),
});

export const finalize = internalMutation({
  args: { migrationId: v.string() },
  returns: migrationStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(finalizeProgram(ctx, args.migrationId)),
});
