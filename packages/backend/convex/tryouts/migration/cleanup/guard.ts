import { computeTryoutHistoryCleanupLimit } from "@nakafa/aksara-contracts/migration/tryout/history/cleanup";
import { hashTryoutHistoryMigrationPlan } from "@nakafa/aksara-contracts/migration/tryout/history/hash";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { isSnapshotReferenced } from "@repo/backend/convex/contentRelease/snapshot/retention";
import type { CleanupProof } from "@repo/backend/convex/tryouts/migration/cleanup/schema";
import { decodeMigrationPlan } from "@repo/backend/convex/tryouts/migration/plan";
import { Effect } from "effect";

export type CleanupMigration = Extract<
  Doc<"tryoutHistoryMigrations">,
  { readonly phase: "cleaning" | "completed" }
>;

/** Checks the root still repeats every permanently signed receipt fact. */
export function hasCleanupReceiptBinding(
  migration: CleanupMigration,
  receipt: Doc<"tryoutHistoryMigrationReceipts">
) {
  return (
    migration.migrationId === receipt.migrationId &&
    migration.authorization.planHash === receipt.planHash &&
    migration.sourceSnapshotId === receipt.sourceSnapshotId &&
    migration.target.bundleHash === receipt.targetBundleHash &&
    migration.target.snapshotId === receipt.targetSnapshotId &&
    migration.completion.cleanupLimit === receipt.cleanupLimit &&
    migration.completion.completedAt === receipt.completedAt &&
    migration.completion.migratedAttempts === receipt.migratedAttempts &&
    migration.completion.migratedScaleItems === receipt.migratedScaleItems &&
    migration.completion.migratedScaleRuns === receipt.migratedScaleRuns &&
    migration.completion.migratedScaleVersions === receipt.migratedScaleVersions
  );
}

export function hasSameCleanupProof(left: CleanupProof, right: CleanupProof) {
  return (
    left.assetHash === right.assetHash && left.sourceSha === right.sourceSha
  );
}

/** Recomputes the signed payload identity retained during bounded cleanup. */
export const requireCleanupPlan = Effect.fn(
  "tryouts.migration.requireCleanupPlan"
)(function* (migration: CleanupMigration) {
  const plan = yield* decodeMigrationPlan(migration.authorization.planJson);
  const planHash = yield* hashTryoutHistoryMigrationPlan(plan.payload).pipe(
    Effect.mapError(contractFailure)
  );
  const cleanupLimit = yield* computeTryoutHistoryCleanupLimit(
    plan.payload
  ).pipe(Effect.mapError(contractFailure));
  if (
    plan.planHash !== planHash ||
    planHash !== migration.authorization.planHash ||
    plan.payload.migrationId !== migration.migrationId ||
    plan.payload.source.snapshot.snapshotId !== migration.sourceSnapshotId ||
    plan.payload.target.bundleHash !== migration.target.bundleHash ||
    plan.payload.target.snapshot.snapshotId !== migration.target.snapshotId ||
    plan.payload.source.scales.versionCount !==
      migration.authorization.sourceScaleVersionIds.length ||
    plan.payload.target.artifacts.count !== migration.artifactMapCount ||
    plan.payload.target.catalog.count !== migration.catalogMapCount ||
    plan.payload.target.placements.count !== migration.placementMapCount ||
    cleanupLimit !== migration.completion.cleanupLimit
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup lost its authenticated plan payload."
    );
  }
  return plan;
});

/** Proves every destructive precondition before the first cleanup write. */
export const requireCleanupPreconditions = Effect.fn(
  "tryouts.migration.requireCleanupPreconditions"
)(function* (ctx: MutationCtx, migration: CleanupMigration) {
  const [markers, sourceAttempt, scales] = yield* Effect.all([
    Effect.promise(() => ctx.db.query("tryoutAttemptHistory").take(1)),
    Effect.promise(() =>
      ctx.db
        .query("tryoutAttempts")
        .withIndex("by_tryoutSnapshotId", (query) =>
          query.eq("tryoutSnapshotId", migration.sourceSnapshotId)
        )
        .first()
    ),
    Effect.forEach(migration.authorization.sourceScaleVersionIds, (id) =>
      Effect.promise(() => ctx.db.get(id))
    ),
  ]);
  if (markers[0]) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup found an unmigrated attempt marker."
    );
  }
  if (sourceAttempt) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history cleanup found an attempt on the retained source snapshot."
    );
  }
  if (
    scales.some(
      (scale) =>
        scale !== null && scale.tryoutSnapshotId !== migration.sourceSnapshotId
    ) ||
    (migration.phase === "completed" && scales.some((scale) => scale === null))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "A retained IRT scale changed before signed cleanup."
    );
  }
  const scaleReferences = yield* Effect.forEach(
    migration.authorization.sourceScaleVersionIds,
    (scaleVersionId) =>
      Effect.all({
        attempt: Effect.promise(() =>
          ctx.db
            .query("tryoutAttempts")
            .withIndex("by_scaleVersionId", (query) =>
              query.eq("scaleVersionId", scaleVersionId)
            )
            .first()
        ),
        score: Effect.promise(() =>
          ctx.db
            .query("tryoutScores")
            .withIndex("by_scaleVersionId", (query) =>
              query.eq("scaleVersionId", scaleVersionId)
            )
            .first()
        ),
      })
  );
  if (
    scaleReferences.some(
      ({ attempt, score }) => attempt !== null || score !== null
    )
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "A retained IRT scale is still referenced by a try-out attempt or score."
    );
  }
});

/** Proves no live reader retains the source snapshot after bounded repair. */
export const requireCleanupRetention = Effect.fn(
  "tryouts.migration.requireCleanupRetention"
)(function* (ctx: MutationCtx, migration: CleanupMigration) {
  const referenced = yield* isSnapshotReferenced(
    ctx,
    "tryout",
    migration.sourceSnapshotId,
    {
      ignoredMigrationId: migration.migrationId,
      ignoredScaleVersionIds: migration.authorization.sourceScaleVersionIds,
    }
  );
  if (referenced) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "The retained try-out snapshot is still protected from cleanup."
    );
  }
});
