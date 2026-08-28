import { computeTryoutHistoryCleanupLimit } from "@nakafa/aksara-contracts/migration/tryout/history/cleanup";
import { hashTryoutHistoryMigrationPlan } from "@nakafa/aksara-contracts/migration/tryout/history/hash";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { internalQuery } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { requireSealedPredecessorObservation } from "@repo/backend/convex/contentRelease/predecessor/control";
import { contractFailure } from "@repo/backend/convex/contentRelease/proof/failure";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { decodeMigrationPlan } from "@repo/backend/convex/tryouts/migration/plan";
import { verifyScaleClone } from "@repo/backend/convex/tryouts/migration/scale/clone";
import { readTryoutHistoryScaleGraph } from "@repo/backend/convex/tryouts/migration/scale/inventory";
import { terminalRecordValidator } from "@repo/backend/convex/tryouts/migration/state/schema";
import {
  completedMigrationStatus,
  loadTryoutHistoryMigration,
} from "@repo/backend/convex/tryouts/migration/state/store";
import {
  findTryoutRuntimeBundleByHash,
  loadTryoutRuntimeBundle,
} from "@repo/backend/convex/tryouts/runtime/signed";
import { v } from "convex/values";
import { Effect } from "effect";

type ReadCtx = MutationCtx | QueryCtx;
type TerminalMigration = Extract<
  Doc<"tryoutHistoryMigrations">,
  { readonly phase: "completed" | "running" }
>;

/** Proves every cloned scale still exactly reproduces its authorized source. */
const verifyScaleClones = Effect.fn("tryouts.migration.verifyScaleClones")(
  function* (
    ctx: ReadCtx,
    migration: TerminalMigration,
    mappings: readonly Doc<"tryoutHistoryScaleMigrations">[]
  ) {
    const bySource = new Map(
      mappings.map((mapping) => [mapping.oldScaleVersionId, mapping])
    );
    const targetIds = new Set(
      mappings.map(({ newScaleVersionId }) => newScaleVersionId)
    );
    if (
      bySource.size !== migration.authorization.sourceScaleVersionIds.length ||
      targetIds.size !== mappings.length
    ) {
      return yield* releaseFail(
        "CONTENT_RELEASE_INTEGRITY",
        "Try-out history scale migration identities are incomplete."
      );
    }
    for (const sourceScaleVersionId of migration.authorization
      .sourceScaleVersionIds) {
      const mapping = bySource.get(sourceScaleVersionId);
      if (!mapping) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history scale migration lost an authorized source."
        );
      }
      const source = yield* readTryoutHistoryScaleGraph(
        ctx,
        sourceScaleVersionId,
        migration.sourceSnapshotId
      );
      yield* verifyScaleClone(
        ctx,
        migration.migrationId,
        source,
        mapping,
        migration.target.snapshotId
      );
    }
    return targetIds;
  }
);

/** Revalidates all transaction-local terminal facts before status can be signed. */
export const verifyTerminalStorage = Effect.fn(
  "tryouts.migration.verifyTerminalStorage"
)(function* (ctx: ReadCtx, migration: TerminalMigration) {
  yield* requireSealedPredecessorObservation(
    ctx,
    migration.predecessorObservationId
  );
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
    (migration.phase === "completed" &&
      migration.completion.cleanupLimit !== cleanupLimit)
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration lost its signed terminal authorization."
    );
  }
  const bundleRow = yield* findTryoutRuntimeBundleByHash(
    ctx,
    migration.target.bundleHash
  );
  if (!bundleRow) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Completed try-out history migration lost its target bundle."
    );
  }
  const runtime = yield* loadTryoutRuntimeBundle(
    ctx,
    bundleRow.snapshotId,
    bundleRow.rendererManifestHash
  );
  if (
    !runtime ||
    runtime.bundle.bundleHash !== migration.target.bundleHash ||
    runtime.bundle.payload.snapshot.snapshotId !== migration.target.snapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Completed try-out history runtime changed its permanent identity."
    );
  }
  const { audits, markers, scaleMappings } = yield* Effect.all({
    audits: Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryAttemptMigrationAudits")
        .withIndex("by_migrationId_and_tryoutAttemptId", (query) =>
          query.eq("migrationId", migration.migrationId)
        )
        .take(plan.payload.source.attempts.attemptCount + 1)
    ),
    markers: Effect.promise(() => ctx.db.query("tryoutAttemptHistory").take(1)),
    scaleMappings: Effect.promise(() =>
      ctx.db
        .query("tryoutHistoryScaleMigrations")
        .withIndex("by_migrationId_and_oldScaleVersionId", (query) =>
          query.eq("migrationId", migration.migrationId)
        )
        .take(plan.payload.source.scales.versionCount + 1)
    ),
  });
  const targetScaleIds = yield* verifyScaleClones(
    ctx,
    migration,
    scaleMappings
  );
  const progress =
    migration.phase === "running" ? migration.progress : migration.completion;
  const countersMatch =
    progress.migratedAttempts === plan.payload.source.attempts.attemptCount &&
    progress.migratedScaleItems === plan.payload.source.scales.itemCount &&
    progress.migratedScaleRuns === plan.payload.source.scales.runCount &&
    progress.migratedScaleVersions === plan.payload.source.scales.versionCount;
  if (
    audits.length !== plan.payload.source.attempts.attemptCount ||
    audits.some(({ phase }) => phase !== "completed") ||
    markers.length !== 0 ||
    !countersMatch
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration has incomplete terminal evidence."
    );
  }
  yield* Effect.forEach(audits, (audit) =>
    Effect.gen(function* () {
      if (audit.phase !== "completed") {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Try-out history migration retained a pending attempt audit."
        );
      }
      const attempt = yield* Effect.promise(() =>
        ctx.db.get(audit.tryoutAttemptId)
      );
      if (
        !attempt ||
        audit.targetBundleHash !== migration.target.bundleHash ||
        audit.targetSnapshotId !== migration.target.snapshotId ||
        attempt.tryoutBundleId !== bundleRow._id ||
        attempt.tryoutBundleHash !== audit.targetBundleHash ||
        attempt.tryoutSnapshotId !== audit.targetSnapshotId ||
        attempt.scaleVersionId !== audit.targetScaleVersionId ||
        attempt.status === "in-progress" ||
        (audit.targetScaleVersionId !== undefined &&
          !targetScaleIds.has(audit.targetScaleVersionId))
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Migrated try-out attempt changed its terminal runtime binding."
        );
      }
      const score = yield* Effect.promise(() =>
        ctx.db
          .query("tryoutScores")
          .withIndex("by_tryoutAttemptId", (query) =>
            query.eq("tryoutAttemptId", attempt._id)
          )
          .unique()
      );
      if (
        score &&
        (score.tryoutSnapshotId !== audit.targetSnapshotId ||
          score.scaleVersionId !== audit.targetScaleVersionId)
      ) {
        return yield* releaseFail(
          "CONTENT_RELEASE_INTEGRITY",
          "Migrated try-out score changed its terminal runtime binding."
        );
      }
    })
  );
  return { cleanupLimit, plan };
});

/** Returns only a fully revalidated completed root to the Node proof boundary. */
const terminalProgram = Effect.fn("tryouts.migration.terminal")(function* (
  ctx: QueryCtx,
  migrationId: string
) {
  const migration = yield* loadTryoutHistoryMigration(ctx, migrationId);
  if (migration.phase !== "completed") {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Try-out history migration has no completed terminal state."
    );
  }
  yield* verifyTerminalStorage(ctx, migration);
  return {
    planJson: migration.authorization.planJson,
    status: completedMigrationStatus(migration),
  };
});

export const terminal = internalQuery({
  args: { migrationId: v.string() },
  returns: terminalRecordValidator,
  handler: (ctx, args) =>
    runConvexProgram(terminalProgram(ctx, args.migrationId)),
});
