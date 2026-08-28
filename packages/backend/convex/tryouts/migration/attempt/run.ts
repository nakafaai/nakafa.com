import type { Doc, Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/_generated/server";
import { releaseFail } from "@repo/backend/convex/contentRelease/error";
import { requireSealedPredecessorObservation } from "@repo/backend/convex/contentRelease/predecessor/control";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import {
  hashTryoutHistoryAttemptEntry,
  readTryoutHistoryAttemptEntry,
} from "@repo/backend/convex/tryouts/migration/attempt/inventory";
import { migratePlacements } from "@repo/backend/convex/tryouts/migration/attempt/placement";
import { migrateSections } from "@repo/backend/convex/tryouts/migration/attempt/section";
import { decodeMigrationPlan } from "@repo/backend/convex/tryouts/migration/plan";
import { migrateTryoutHistoryScale } from "@repo/backend/convex/tryouts/migration/scale/run";
import { v } from "convex/values";
import { Clock, Effect } from "effect";

/** Migrates one marked terminal attempt and deletes its marker last. */
const migrateAttempt = Effect.fn("tryouts.migration.migrateAttempt")(function* (
  ctx: MutationCtx,
  migrationId: string,
  marker: Doc<"tryoutAttemptHistory">
) {
  const roots = yield* Effect.promise(() =>
    ctx.db.query("tryoutHistoryMigrations").take(2)
  );
  const root = roots[0];
  if (
    roots.length !== 1 ||
    !root ||
    root.migrationId !== migrationId ||
    root.phase !== "running"
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_STATE",
      "Try-out history migration is not authorized to run."
    );
  }
  yield* requireSealedPredecessorObservation(
    ctx,
    root.predecessorObservationId
  );
  const targetBundleHash = root.target.bundleHash;
  const targetSnapshotId = root.target.snapshotId;
  const plan = yield* decodeMigrationPlan(root.authorization.planJson);
  if (
    plan.planHash !== root.authorization.planHash ||
    plan.payload.migrationId !== root.migrationId ||
    plan.payload.target.bundleHash !== targetBundleHash ||
    plan.payload.target.snapshot.snapshotId !== targetSnapshotId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration lost its signed authorization."
    );
  }
  if (
    root.progress.migratedAttempts >= plan.payload.source.attempts.attemptCount
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Try-out history migration exceeded its signed attempt count."
    );
  }
  const audit = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutHistoryAttemptMigrationAudits")
      .withIndex("by_migrationId_and_tryoutAttemptId", (query) =>
        query
          .eq("migrationId", root.migrationId)
          .eq("tryoutAttemptId", marker.tryoutAttemptId)
      )
      .unique()
  );
  const sourceEntry = yield* readTryoutHistoryAttemptEntry(ctx, marker);
  const sourceDigest = yield* hashTryoutHistoryAttemptEntry(sourceEntry);
  const { attempt } = sourceEntry;
  if (
    audit?.phase !== "pending" ||
    audit.userId !== attempt.userId ||
    audit.tryoutAttemptHistoryId !== marker._id ||
    audit.sourceDigest !== sourceDigest ||
    attempt.status === "in-progress" ||
    attempt.tryoutSnapshotId !== root.sourceSnapshotId ||
    marker.tryoutSnapshotId !== root.sourceSnapshotId ||
    marker.snapshotReleaseId !== attempt.snapshotReleaseId
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained attempt changed before its atomic migration."
    );
  }
  const bundle = yield* Effect.promise(() =>
    ctx.db
      .query("tryoutRuntimeBundles")
      .withIndex("by_bundleHash", (query) =>
        query.eq("bundleHash", targetBundleHash)
      )
      .unique()
  );
  if (!bundle || bundle.snapshotId !== targetSnapshotId) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained attempt target bundle is missing."
    );
  }
  const sectionSnapshots = yield* migrateSections(
    ctx,
    root.migrationId,
    attempt,
    targetSnapshotId
  );
  yield* migratePlacements(ctx, root.migrationId, attempt, targetSnapshotId);
  let scaleVersionId: Id<"irtScaleVersions"> | undefined;
  let migratedScaleItems = 0;
  let migratedScaleRuns = 0;
  let migratedScaleVersions = 0;
  if (attempt.scaleVersionId) {
    const scale = yield* migrateTryoutHistoryScale(
      ctx,
      root.migrationId,
      attempt.scaleVersionId,
      root.authorization.sourceScaleVersionIds,
      plan.payload.source.scales,
      targetSnapshotId
    );
    scaleVersionId = scale.scaleVersionId;
    migratedScaleItems = scale.itemCount;
    migratedScaleRuns = scale.runCount;
    migratedScaleVersions = scale.scaleVersionCount;
  }
  const { score } = sourceEntry;
  if (
    score &&
    (score.scaleVersionId !== attempt.scaleVersionId ||
      (score.scaleVersionId === undefined) !== (scaleVersionId === undefined))
  ) {
    return yield* releaseFail(
      "CONTENT_RELEASE_INTEGRITY",
      "Retained attempt and score disagree on IRT scale ownership."
    );
  }
  if (score) {
    yield* Effect.promise(() =>
      ctx.db.patch("tryoutScores", score._id, {
        scaleVersionId,
        tryoutSnapshotId: targetSnapshotId,
      })
    );
  }
  const now = yield* Clock.currentTimeMillis;
  yield* Effect.promise(() =>
    ctx.db.patch("tryoutAttempts", attempt._id, {
      scaleVersionId,
      sectionSnapshots,
      tryoutBundleHash: bundle.bundleHash,
      tryoutBundleId: bundle._id,
      tryoutSnapshotId: targetSnapshotId,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.patch("tryoutHistoryMigrations", root._id, {
      progress: {
        migratedAttempts: root.progress.migratedAttempts + 1,
        migratedScaleItems:
          root.progress.migratedScaleItems + migratedScaleItems,
        migratedScaleRuns: root.progress.migratedScaleRuns + migratedScaleRuns,
        migratedScaleVersions:
          root.progress.migratedScaleVersions + migratedScaleVersions,
      },
      updatedAt: now,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.patch("tryoutHistoryAttemptMigrationAudits", audit._id, {
      phase: "completed",
      targetBundleHash,
      targetScaleVersionId: scaleVersionId,
      targetSnapshotId,
    })
  );
  yield* Effect.promise(() =>
    ctx.db.delete("tryoutAttemptHistory", marker._id)
  );
});

/** Migrates at most one marked attempt and reports exact remaining state. */
export const next = internalMutation({
  args: { migrationId: v.string() },
  returns: v.object({
    done: v.boolean(),
    migrated: v.union(v.literal(0), v.literal(1)),
  }),
  handler: (ctx, args) =>
    runConvexProgram(
      Effect.gen(function* () {
        const marker = yield* Effect.promise(() =>
          ctx.db.query("tryoutAttemptHistory").first()
        );
        if (!marker) {
          const migrated = 0 as const;
          return { done: true, migrated };
        }
        yield* migrateAttempt(ctx, args.migrationId, marker);
        const remaining = yield* Effect.promise(() =>
          ctx.db.query("tryoutAttemptHistory").first()
        );
        const migrated = 1 as const;
        return { done: remaining === null, migrated };
      })
    ),
});
