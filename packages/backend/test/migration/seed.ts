import { strict as assert } from "node:assert/strict";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedLedger } from "@repo/backend/test/migration/ledger";
import { seedRoot } from "@repo/backend/test/migration/root";
import {
  seedSourceRows,
  seedSourceScale,
  seedTargetScale,
} from "@repo/backend/test/migration/source";
import {
  CLEANUP_MIGRATION_ID,
  CLEANUP_SOURCE_SNAPSHOT,
  type CleanupTest,
} from "@repo/backend/test/migration/state";
import { seedTarget } from "@repo/backend/test/migration/target";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";

/** Seeds one pending audit that holds its account against erasure. */
export async function seedMigrationHold(ctx: MutationCtx, suffix: string) {
  const runtime = await seedTryoutContentAccessState(ctx, {
    attemptStatus: "completed",
    sectionStatus: "completed",
    suffix,
  });
  const attempt = await ctx.db.get(runtime.attemptId);
  assert.ok(attempt, "Expected one migration hold attempt.");
  const user = await ctx.db.get(attempt.userId);
  assert.ok(user, "Expected one migration hold user.");
  const markerId = await ctx.db.insert("tryoutAttemptHistory", {
    snapshotReleaseId: attempt.snapshotReleaseId,
    tryoutAttemptId: attempt._id,
    tryoutSnapshotId: attempt.tryoutSnapshotId,
  });
  await ctx.db.insert("tryoutHistoryAttemptMigrationAudits", {
    migrationId: suffix,
    phase: "pending",
    sourceDigest: "source-digest",
    tryoutAttemptHistoryId: markerId,
    tryoutAttemptId: attempt._id,
    userId: attempt.userId,
  });
  return { authId: user.authId, userId: user._id };
}

/** Seeds one guard scenario whose first cleanup call must not write. */
export function seedCleanupGuard(
  t: CleanupTest,
  guard:
    | "attempt"
    | "marker"
    | "receipt"
    | "reference"
    | "scaleAttempt"
    | "scaleScore"
) {
  return t.mutation(async (ctx) => {
    const target = await seedTarget(ctx);
    const referencedScale =
      guard === "scaleAttempt" || guard === "scaleScore"
        ? await seedSourceScale(ctx)
        : null;
    await ctx.db.insert("contentSnapshots", {
      createdAt: 1,
      family: "tryout",
      retainUntil: Number.MAX_SAFE_INTEGER,
      snapshotId: CLEANUP_SOURCE_SNAPSHOT,
      snapshotJson: "{}",
    });
    await seedRoot(
      ctx,
      target,
      referencedScale === null ? [] : [referencedScale.scaleVersionId]
    );
    if (guard === "marker") {
      await ctx.db.insert("tryoutAttemptHistory", {
        snapshotReleaseId: "source-release",
        tryoutAttemptId: target.attemptId,
        tryoutSnapshotId: CLEANUP_SOURCE_SNAPSHOT,
      });
    }
    if (guard === "attempt") {
      await ctx.db.patch(target.attemptId, {
        tryoutSnapshotId: CLEANUP_SOURCE_SNAPSHOT,
      });
    }
    if (guard === "reference") {
      await seedSourceScale(ctx);
    }
    if (guard === "scaleAttempt") {
      assert.ok(referencedScale, "Expected one referenced source scale.");
      await ctx.db.patch(target.attemptId, {
        scaleVersionId: referencedScale.scaleVersionId,
      });
    }
    if (guard === "scaleScore") {
      assert.ok(referencedScale, "Expected one referenced source scale.");
      const attempt = await ctx.db.get(target.attemptId);
      assert.ok(attempt, "Expected one permanent target attempt.");
      await ctx.db.insert("tryoutScores", {
        finalizedAt: 1,
        publishedScore: 0,
        rawScore: 0,
        scaleVersionId: referencedScale.scaleVersionId,
        scoringStrategy: attempt.scoringStrategy,
        scoreStatus: attempt.scoreStatus,
        setIdentity: attempt.setIdentity,
        totalCorrect: 0,
        totalQuestions: attempt.totalQuestions,
        tryoutAttemptId: attempt._id,
        tryoutSnapshotId: attempt.tryoutSnapshotId,
        userId: attempt.userId,
      });
    }
    return target;
  });
}

/** Seeds a multi-page source plus permanent target and shared references. */
export function seedCleanupSuccess(t: CleanupTest, sourceScaleCount = 1) {
  return t.mutation(async (ctx) => {
    const target = await seedTarget(ctx);
    const sourceScale = await seedSourceScale(ctx);
    const targetScale = await seedTargetScale(
      ctx,
      target.snapshotId,
      target.placement.rowHash
    );
    const scalePairs = [{ source: sourceScale, target: targetScale }];
    for (let index = 1; index < sourceScaleCount; index += 1) {
      scalePairs.push({
        source: await seedSourceScale(ctx),
        target: await seedTargetScale(
          ctx,
          target.snapshotId,
          target.placement.rowHash
        ),
      });
    }
    const sourceScales = scalePairs.map(({ source }) => source);
    const targetScales = scalePairs.map(({ target: scale }) => scale);
    const attempt = await ctx.db.get(target.attemptId);
    assert.ok(attempt, "Expected one permanent target attempt.");
    await ctx.db.patch(target.attemptId, {
      scaleVersionId: targetScale.scaleVersionId,
    });
    await seedSourceRows(ctx, target);
    const markerId = await ctx.db.insert("tryoutAttemptHistory", {
      snapshotReleaseId: "source-release",
      tryoutAttemptId: target.attemptId,
      tryoutSnapshotId: CLEANUP_SOURCE_SNAPSHOT,
    });
    await ctx.db.delete(markerId);
    await ctx.db.insert("tryoutHistoryAttemptMigrationAudits", {
      migrationId: CLEANUP_MIGRATION_ID,
      phase: "completed",
      sourceDigest: "source-digest",
      targetBundleHash: target.bundleHash,
      targetScaleVersionId: targetScale.scaleVersionId,
      targetSnapshotId: target.snapshotId,
      tryoutAttemptHistoryId: markerId,
      tryoutAttemptId: target.attemptId,
      userId: attempt.userId,
    });
    await seedLedger(ctx, scalePairs, target.placement.rowHash);
    await seedRoot(
      ctx,
      target,
      sourceScales.map(({ scaleVersionId }) => scaleVersionId)
    );
    return {
      sourceScale,
      sourceScales,
      target,
      targetScales,
      targetRunId: targetScale.runId,
      targetScaleId: targetScale.scaleVersionId,
    };
  });
}
