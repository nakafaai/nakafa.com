import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const NOW = Date.UTC(2026, 3, 3, 12, 0, 0);

/** Insert one active tryout for maintenance tests. */
async function insertActiveTryout(ctx: MutationCtx, slug: string) {
  return await ctx.db.insert("tryouts", {
    catalogPosition: 1,
    product: "snbt",
    locale: "id",
    cycleKey: "2026",
    slug,
    label: slug,
    partCount: 0,
    totalQuestionCount: 0,
    isActive: true,
    detectedAt: NOW,
    syncedAt: NOW,
  });
}

/** Insert one single-question exercise set for maintenance tests. */
async function insertExerciseSet(ctx: MutationCtx, slugSuffix: string) {
  return await ctx.db.insert("exerciseSets", {
    locale: "id",
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${slugSuffix}`,
    category: "high-school",
    type: "snbt",
    material: "quantitative-knowledge",
    exerciseType: "try-out",
    setName: slugSuffix,
    title: `Set ${slugSuffix}`,
    questionCount: 1,
    syncedAt: NOW,
  });
}

/** Insert one lightweight user for maintenance tests. */
async function insertUser(ctx: MutationCtx, suffix: string) {
  return await ctx.db.insert("users", {
    email: `${suffix}@example.com`,
    authId: `auth-${suffix}`,
    name: `User ${suffix}`,
    plan: "free",
    credits: 0,
    creditsResetAt: NOW,
  });
}

/** Insert one completed standalone simulation set attempt for maintenance tests. */
async function insertCompletedSimulationAttempt(
  ctx: MutationCtx,
  slugSuffix: string
) {
  const setId = await insertExerciseSet(ctx, slugSuffix);
  const set = await ctx.db.get("exerciseSets", setId);
  const userId = await insertUser(ctx, `maintenance-${slugSuffix}`);

  if (!set) {
    throw new Error("Expected exercise set to exist");
  }

  const attemptId = await ctx.db.insert("exerciseAttempts", {
    slug: set.slug,
    userId,
    origin: "standalone",
    mode: "simulation",
    scope: "set",
    timeLimit: 90,
    startedAt: NOW - 60_000,
    lastActivityAt: NOW,
    completedAt: NOW,
    endReason: "submitted",
    status: "completed",
    updatedAt: NOW,
    totalExercises: 1,
    answeredCount: 1,
    correctAnswers: 1,
    totalTime: 45,
    scorePercentage: 100,
  });

  return {
    attemptId,
    setId,
  };
}

describe("irt/queries/internal/maintenance", () => {
  it("treats blocked tryouts with published provisional scales as startable", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const tryoutId = await insertActiveTryout(ctx, "blocked-but-startable");

      await ctx.db.insert("irtScaleQualityChecks", {
        tryoutId,
        status: "blocked",
        blockingReason: "missing-calibrated-items",
        totalQuestionCount: 150,
        calibratedQuestionCount: 0,
        staleQuestionCount: 0,
        minAttemptCount: 0,
        liveWindowStartAt: NOW,
        checkedAt: NOW,
      });
      await ctx.db.insert("irtScaleVersions", {
        tryoutId,
        model: "2pl",
        status: "provisional",
        questionCount: 150,
        publishedAt: NOW,
      });
    });

    const result = await t.query(
      internal.irt.queries.internal.maintenance.getScaleQualityIntegrity,
      {
        paginationOpts: {
          cursor: null,
          numItems: 100,
        },
      }
    );

    expect(result).toEqual({
      continueCursor: expect.any(String),
      isDone: true,
      missingQualityCheckTryoutCount: 0,
      unstartableTryoutCount: 0,
    });
  });

  it("flags active tryouts missing a quality check and frozen scale", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      await insertActiveTryout(ctx, "missing-quality-and-scale");
    });

    const result = await t.query(
      internal.irt.queries.internal.maintenance.getScaleQualityIntegrity,
      {
        paginationOpts: {
          cursor: null,
          numItems: 100,
        },
      }
    );

    expect(result).toEqual({
      continueCursor: expect.any(String),
      isDone: true,
      missingQualityCheckTryoutCount: 1,
      unstartableTryoutCount: 1,
    });
  });

  it("flags pending calibration attempts missing queue ownership", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const { attemptId, setId } = await insertCompletedSimulationAttempt(
        ctx,
        "missing-queue"
      );

      await ctx.db.insert("irtCalibrationAttempts", {
        setId,
        attemptId,
        responses: [],
      });
    });

    const result = await t.query(
      internal.irt.queries.internal.maintenance
        .getCalibrationQueueAttemptIntegrity,
      {
        paginationOpts: {
          cursor: null,
          numItems: 100,
        },
      }
    );

    expect(result).toEqual({
      continueCursor: expect.any(String),
      duplicatePendingAttemptCount: 0,
      isDone: true,
      missingPendingQueueAttemptCount: 1,
      staleAttemptQueueSetCount: 0,
    });
  });

  it("flags orphaned and stale queue rows", async () => {
    const t = convexTest(schema, convexModules);

    await t.mutation(async (ctx) => {
      const { attemptId, setId } = await insertCompletedSimulationAttempt(
        ctx,
        "stale-queue"
      );

      await ctx.db.insert("irtCalibrationAttempts", {
        setId,
        attemptId,
        responses: [],
      });
      await ctx.db.insert("irtCalibrationRuns", {
        setId,
        model: "2pl",
        status: "completed",
        questionCount: 1,
        responseCount: 1,
        attemptCount: 1,
        iterationCount: 1,
        maxParameterDelta: 0.001,
        startedAt: NOW + 1000,
        updatedAt: NOW + 1000,
        completedAt: NOW + 2000,
      });
      await ctx.db.insert("irtCalibrationQueue", {
        setId,
        attemptId,
        enqueuedAt: NOW,
      });

      const orphanedSetId = await insertExerciseSet(ctx, "orphaned-queue");
      const orphanedAttemptId = await insertCompletedSimulationAttempt(
        ctx,
        "orphaned-queue-attempt"
      );

      await ctx.db.insert("irtCalibrationQueue", {
        setId: orphanedSetId,
        attemptId: orphanedAttemptId.attemptId,
        enqueuedAt: NOW,
      });
    });

    const result = await t.query(
      internal.irt.queries.internal.maintenance
        .getCalibrationQueueEntryIntegrity,
      {
        paginationOpts: {
          cursor: null,
          numItems: 100,
        },
      }
    );

    expect(result).toEqual({
      continueCursor: expect.any(String),
      isDone: true,
      orphanedQueueEntryCount: 1,
      staleQueueEntryCount: 1,
    });
  });
});
