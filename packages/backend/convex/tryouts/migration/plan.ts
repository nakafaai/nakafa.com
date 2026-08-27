import {
  type SignedTryoutHistoryMigrationPlan,
  SignedTryoutHistoryMigrationPlanSchema,
} from "@nakafa/aksara-contracts/migration/tryout/history/spec";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import {
  ReleaseError,
  releaseFail,
} from "@repo/backend/convex/contentRelease/error";
import { parseStoredJson } from "@repo/backend/convex/contentRelease/parse";
import { loadSnapshot } from "@repo/backend/convex/contentRelease/snapshot/manifest";
import { ROLLBACK_RETENTION_MS } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { retainedTryoutHistoryPlan } from "@repo/backend/convex/tryouts/history/spec";
import {
  hashTryoutHistoryAttemptEntry,
  type TryoutHistoryAttemptInventoryEntry,
  verifyTryoutHistoryAttemptInventory,
} from "@repo/backend/convex/tryouts/migration/attempt/inventory";
import { requireMigrationUsersAvailable } from "@repo/backend/convex/tryouts/migration/erasure";
import {
  readRetainedScaleVersionIds,
  verifyTryoutHistoryScaleInventory,
} from "@repo/backend/convex/tryouts/migration/scale/inventory";
import { migrationStatusValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import {
  loadTryoutHistoryMigration,
  migrationStatus,
} from "@repo/backend/convex/tryouts/migration/state/store";
import { findTryoutRuntimeBundleByHash } from "@repo/backend/convex/tryouts/runtime/signed";
import { v } from "convex/values";
import { Clock, Effect, Schema } from "effect";

/** Strictly decodes the Node-authenticated plan before durable storage. */
export const decodeMigrationPlan = Effect.fn("tryouts.migration.decodePlan")(
  (source: string) =>
    parseStoredJson(source, "Try-out history migration plan").pipe(
      Effect.flatMap(
        Schema.decodeUnknownEffect(SignedTryoutHistoryMigrationPlanSchema, {
          onExcessProperty: "error",
        })
      ),
      Effect.mapError(
        () =>
          new ReleaseError({
            code: "CONTENT_RELEASE_INTEGRITY",
            message:
              "Try-out history migration plan violates its wire contract.",
          })
      )
    )
);

/** Persists one private digest per attempt after the aggregate plan matches. */
const stageAttemptAudits = Effect.fn("tryouts.migration.stageAttemptAudits")(
  function* (
    ctx: MutationCtx,
    migrationId: string,
    entries: readonly TryoutHistoryAttemptInventoryEntry[]
  ) {
    const existing = yield* Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryAttemptMigrationAudits")
        .withIndex("by_migrationId_and_tryoutAttemptId", (query) =>
          query.eq("migrationId", migrationId)
        )
        .take(1)
    );
    if (existing[0]) {
      return yield* releaseFail(
        "CONTENT_RELEASE_CONFLICT",
        "Try-out history attempt audits already exist."
      );
    }
    for (const entry of entries) {
      const sourceDigest = yield* hashTryoutHistoryAttemptEntry(entry);
      yield* Effect.promise(() =>
        ctx.db.insert("tryoutHistoryAttemptMigrationAudits", {
          migrationId,
          phase: "pending",
          sourceDigest,
          tryoutAttemptHistoryId: entry.marker._id,
          tryoutAttemptId: entry.attempt._id,
          userId: entry.attempt.userId,
        })
      );
    }
  }
);

/** Checks all target rows and immutable bundle exist before authorization. */
const requireTargetStorage = Effect.fn(
  "tryouts.migration.requireTargetStorage"
)(function* (ctx: MutationCtx, plan: SignedTryoutHistoryMigrationPlan) {
  const { target } = plan.payload;
  const { bundle, catalog, placements, snapshot } = yield* Effect.all({
    bundle: findTryoutRuntimeBundleByHash(ctx, target.bundleHash),
    catalog: Effect.promise(() =>
      ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", target.snapshot.snapshotId)
        )
        .take(target.catalog.count + 1)
    ),
    placements: Effect.promise(() =>
      ctx.db
        .query("tryoutPlacements")
        .withIndex("by_snapshotId_and_index", (query) =>
          query.eq("snapshotId", target.snapshot.snapshotId)
        )
        .take(target.placements.count + 1)
    ),
    snapshot: loadSnapshot(ctx, "tryout", target.snapshot.snapshotId),
  });
  const expectedSnapshotJson = JSON.stringify({
    family: "tryout",
    manifest: target.snapshot,
  });
  if (
    !bundle ||
    bundle.snapshotId !== target.snapshot.snapshotId ||
    catalog.length !== target.catalog.count ||
    placements.length !== target.placements.count ||
    !snapshot ||
    snapshot.snapshotJson !== expectedSnapshotJson
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      "Try-out history target storage is incomplete."
    );
  }
  return snapshot;
});

/** Proves every source-snapshot attempt owns one signed history marker. */
export const verifySourceAttemptClosure = Effect.fn(
  "tryouts.migration.verifySourceAttemptClosure"
)(function* (
  sourceAttempts: readonly { readonly _id: string }[],
  inventory: readonly { readonly attempt: { readonly _id: string } }[]
) {
  const authorizedAttemptIds = new Set(
    inventory.map(({ attempt }) => attempt._id)
  );
  if (
    sourceAttempts.length !== authorizedAttemptIds.size ||
    sourceAttempts.some(({ _id }) => !authorizedAttemptIds.has(_id))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Try-out history cutover found an unmarked source attempt."
    );
  }
});

/** Atomically authorizes exactly the fully staged and re-audited target. */
const stagePlanProgram = Effect.fn("tryouts.migration.stagePlan")(function* (
  ctx: MutationCtx,
  migrationId: string,
  planJson: string
) {
  const now = yield* Clock.currentTimeMillis;
  const migration = yield* loadTryoutHistoryMigration(ctx, migrationId);
  const plan = yield* decodeMigrationPlan(planJson);
  if (migration.target.kind !== "staged") {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history plan has no fully staged target."
    );
  }
  const target = migration.target;
  if (
    plan.payload.migrationId !== migrationId ||
    plan.payload.source.snapshot.snapshotId !== migration.sourceSnapshotId ||
    plan.payload.source.snapshot.snapshotId !==
      retainedTryoutHistoryPlan.snapshotId ||
    plan.payload.target.bundleHash !== target.bundleHash ||
    plan.payload.target.snapshot.snapshotId !== target.snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history plan differs from its staging root."
    );
  }
  if (migration.phase === "aborting") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      `Try-out history migration ${migrationId} no longer accepts a plan.`
    );
  }
  if (migration.phase !== "staging") {
    if (
      migration.authorization.planHash === plan.planHash &&
      migration.authorization.planJson === planJson
    ) {
      return migrationStatus(migration);
    }
    return yield* releaseFail(
      "CONTENT_RELEASE_CONFLICT",
      `Try-out history migration ${migrationId} already owns another plan.`
    );
  }
  if (
    migration.artifactMapCount !== plan.payload.target.artifacts.count ||
    migration.catalogMapCount !== plan.payload.target.catalog.count ||
    migration.placementMapCount !== plan.payload.target.placements.count
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_MISSING",
      "Try-out history migration mappings are incomplete."
    );
  }
  const attemptInventory = yield* verifyTryoutHistoryAttemptInventory(
    ctx,
    plan.payload.source.attempts
  );
  const sourceAttempts = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutAttempts")
      .withIndex("by_tryoutSnapshotId", (query) =>
        query.eq("tryoutSnapshotId", migration.sourceSnapshotId)
      )
      .take(plan.payload.source.attempts.attemptCount + 1)
  );
  yield* verifySourceAttemptClosure(sourceAttempts, attemptInventory.entries);
  yield* requireMigrationUsersAvailable(ctx, attemptInventory.entries);
  const sourceScaleVersionIds = yield* readRetainedScaleVersionIds(ctx);
  yield* verifyTryoutHistoryScaleInventory(
    ctx,
    sourceScaleVersionIds,
    plan.payload.source.scales
  );
  const snapshot = yield* requireTargetStorage(ctx, plan);
  yield* stageAttemptAudits(ctx, migrationId, attemptInventory.entries);
  yield* Effect.promise(() =>
    ctx.db.patch("contentSnapshots", snapshot._id, {
      retainUntil: Math.max(snapshot.retainUntil, now + ROLLBACK_RETENTION_MS),
      verifiedAt: now,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.replace("tryoutHistoryMigrations", migration._id, {
      artifactMapCount: migration.artifactMapCount,
      authorization: {
        planHash: plan.planHash,
        planJson,
        sourceScaleVersionIds,
      },
      catalogMapCount: migration.catalogMapCount,
      createdAt: migration.createdAt,
      migrationId,
      phase: "ready",
      placementMapCount: migration.placementMapCount,
      sourceSnapshotId: migration.sourceSnapshotId,
      target,
      updatedAt: now,
    })
  );
  const ready = yield* loadTryoutHistoryMigration(ctx, migrationId);
  return migrationStatus(ready);
});

export const stagePlan = internalMutation({
  args: { migrationId: v.string(), planJson: v.string() },
  returns: migrationStatusValidator,
  handler: (ctx, args) =>
    runConvexProgram(stagePlanProgram(ctx, args.migrationId, args.planJson)),
});
