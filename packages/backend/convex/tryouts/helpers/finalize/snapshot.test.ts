import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { buildFinalizedTryoutSnapshot } from "@repo/backend/convex/tryouts/helpers/finalize/snapshot";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertExerciseQuestion,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/helpers/finalize/snapshot", () => {
  it("fails when a completed finalized part is missing its persisted part attempt", async () => {
    const t = createTryoutTestConvex();

    await expect(
      t.mutation(async (ctx) => {
        const identity = await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "missing-completed-part-attempt",
        });
        const tryout = await insertTryoutSkeleton(
          ctx,
          "missing-completed-part-attempt",
          1
        );
        const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
          userId: identity.userId,
          tryoutId: tryout.tryoutId,
          scaleVersionId: tryout.scaleVersionId,
          scoreStatus: "official",
          status: "completed",
          partSetSnapshots: [
            {
              partIndex: 0,
              partKey: "quantitative-knowledge",
              questionCount: 1,
              setId: tryout.setId,
            },
          ],
          completedPartIndices: [0],
          totalCorrect: 0,
          totalQuestions: 1,
          theta: 0,
          thetaSE: 1,
          startedAt: NOW,
          expiresAt: NOW + ATTEMPT_WINDOW_MS,
          lastActivityAt: NOW,
          completedAt: NOW,
          endReason: "submitted",
        });

        return await buildFinalizedTryoutSnapshot(ctx.db, {
          scaleVersionId: tryout.scaleVersionId,
          tryout: {
            _id: tryout.tryoutId,
            partCount: 1,
            product: "snbt",
            totalQuestionCount: 1,
          },
          tryoutAttempt: {
            _id: tryoutAttemptId,
            completedPartIndices: [0],
            partSetSnapshots: [
              {
                partIndex: 0,
                partKey: "quantitative-knowledge",
                questionCount: 1,
                setId: tryout.setId,
              },
            ],
          },
        });
      })
    ).rejects.toThrow("Completed tryout part is missing its part attempt.");
  });

  it("fails when a persisted tryout part is missing its exercise attempt", async () => {
    const t = createTryoutTestConvex();

    await expect(
      t.mutation(async (ctx) => {
        const identity = await seedAuthenticatedUser(ctx, {
          now: NOW,
          suffix: "missing-snapshot-exercise-attempt",
        });
        const tryout = await insertTryoutSkeleton(
          ctx,
          "missing-snapshot-exercise-attempt",
          1
        );
        const setAttemptId = await ctx.db.insert("exerciseAttempts", {
          slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/missing-snapshot-exercise-attempt",
          userId: identity.userId,
          origin: "tryout",
          mode: "simulation",
          scope: "set",
          timeLimit: 90,
          startedAt: NOW,
          lastActivityAt: NOW,
          completedAt: NOW,
          endReason: "submitted",
          status: "completed",
          updatedAt: NOW,
          totalExercises: 1,
          answeredCount: 0,
          correctAnswers: 0,
          totalTime: 90,
          scorePercentage: 0,
        });
        const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
          userId: identity.userId,
          tryoutId: tryout.tryoutId,
          scaleVersionId: tryout.scaleVersionId,
          scoreStatus: "official",
          status: "completed",
          partSetSnapshots: [
            {
              partIndex: 0,
              partKey: "quantitative-knowledge",
              questionCount: 1,
              setId: tryout.setId,
            },
          ],
          completedPartIndices: [0],
          totalCorrect: 0,
          totalQuestions: 1,
          theta: 0,
          thetaSE: 1,
          startedAt: NOW,
          expiresAt: NOW + ATTEMPT_WINDOW_MS,
          lastActivityAt: NOW,
          completedAt: NOW,
          endReason: "submitted",
        });

        await ctx.db.insert("tryoutPartAttempts", {
          tryoutAttemptId,
          partIndex: 0,
          partKey: "quantitative-knowledge",
          setAttemptId,
          setId: tryout.setId,
          theta: 0,
          thetaSE: 1,
        });
        await ctx.db.delete(setAttemptId);

        return await buildFinalizedTryoutSnapshot(ctx.db, {
          scaleVersionId: tryout.scaleVersionId,
          tryout: {
            _id: tryout.tryoutId,
            partCount: 1,
            product: "snbt",
            totalQuestionCount: 1,
          },
          tryoutAttempt: {
            _id: tryoutAttemptId,
            completedPartIndices: [0],
            partSetSnapshots: [
              {
                partIndex: 0,
                partKey: "quantitative-knowledge",
                questionCount: 1,
                setId: tryout.setId,
              },
            ],
          },
        });
      })
    ).rejects.toThrow("Tryout part is missing its exercise attempt.");
  });

  it("rebuilds finalized snapshots from persisted part set IDs and attempt question counts", async () => {
    const t = createTryoutTestConvex();

    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "snapshot-persisted-set",
      });
      const originalSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/snapshot-original",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "snapshot-original",
        title: "Original Set",
        questionCount: 1,
        syncedAt: NOW,
      });
      const replacementSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/snapshot-replacement",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "snapshot-replacement",
        title: "Replacement Set",
        questionCount: 2,
        syncedAt: NOW,
      });
      const tryoutId = await ctx.db.insert("tryouts", {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "snapshot-persisted-set",
        label: "Snapshot Persisted Set",
        partCount: 1,
        totalQuestionCount: 1,
        isActive: true,
        detectedAt: NOW,
        syncedAt: NOW,
      });
      const tryoutPartSetId = await ctx.db.insert("tryoutPartSets", {
        tryoutId,
        setId: originalSetId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
      });
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        tryoutId,
        model: "2pl",
        status: "official",
        questionCount: 1,
        publishedAt: NOW,
      });
      const originalQuestionId = await insertExerciseQuestion(
        ctx,
        originalSetId,
        {
          slug: "snapshot-original",
        }
      );
      const replacementQuestionId = await insertExerciseQuestion(
        ctx,
        replacementSetId,
        {
          slug: "snapshot-replacement",
        }
      );
      const originalRunId = await ctx.db.insert("irtCalibrationRuns", {
        setId: originalSetId,
        model: "2pl",
        status: "completed",
        questionCount: 1,
        responseCount: 200,
        attemptCount: 200,
        iterationCount: 1,
        maxParameterDelta: 0.001,
        startedAt: NOW,
        updatedAt: NOW,
        completedAt: NOW,
      });
      const replacementRunId = await ctx.db.insert("irtCalibrationRuns", {
        setId: replacementSetId,
        model: "2pl",
        status: "completed",
        questionCount: 1,
        responseCount: 200,
        attemptCount: 200,
        iterationCount: 1,
        maxParameterDelta: 0.001,
        startedAt: NOW,
        updatedAt: NOW,
        completedAt: NOW,
      });

      await ctx.db.insert("irtScaleVersionItems", {
        scaleVersionId,
        calibrationRunId: originalRunId,
        questionId: originalQuestionId,
        setId: originalSetId,
        difficulty: 0,
        discrimination: 1,
      });
      await ctx.db.insert("irtScaleVersionItems", {
        scaleVersionId,
        calibrationRunId: replacementRunId,
        questionId: replacementQuestionId,
        setId: replacementSetId,
        difficulty: 0,
        discrimination: 1,
      });

      const setAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/snapshot-original",
        userId: identity.userId,
        origin: "tryout",
        mode: "simulation",
        scope: "set",
        timeLimit: 90,
        startedAt: NOW,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
        status: "completed",
        updatedAt: NOW,
        totalExercises: 1,
        answeredCount: 1,
        correctAnswers: 1,
        totalTime: 90,
        scorePercentage: 100,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId,
        scaleVersionId,
        scoreStatus: "official",
        status: "completed",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 1,
            setId: originalSetId,
          },
        ],
        completedPartIndices: [0],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
      });

      await ctx.db.insert("exerciseAnswers", {
        attemptId: setAttemptId,
        exerciseNumber: 1,
        questionId: originalQuestionId,
        isCorrect: true,
        timeSpent: 90,
        answeredAt: NOW,
        updatedAt: NOW,
      });
      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
        setAttemptId,
        setId: originalSetId,
        theta: 0,
        thetaSE: 1,
      });

      await ctx.db.patch("tryoutPartSets", tryoutPartSetId, {
        setId: replacementSetId,
      });

      const snapshot = await buildFinalizedTryoutSnapshot(ctx.db, {
        scaleVersionId,
        tryout: {
          _id: tryoutId,
          partCount: 1,
          product: "snbt",
          totalQuestionCount: 1,
        },
        tryoutAttempt: {
          _id: tryoutAttemptId,
          completedPartIndices: [0],
          partSetSnapshots: [
            {
              partIndex: 0,
              partKey: "quantitative-knowledge",
              questionCount: 1,
              setId: originalSetId,
            },
          ],
        },
      });

      return {
        snapshot,
      };
    });

    expect(result.snapshot.totalQuestions).toBe(1);
    expect(result.snapshot.partSnapshots[0]?.score.correctAnswers).toBe(1);
    expect(result.snapshot.partSnapshots[0]?.score.irtScore).toBeGreaterThan(
      500
    );
  });

  it("uses snapshot length when live tryout partCount shrinks below started parts", async () => {
    const t = createTryoutTestConvex();

    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "snapshot-partcount-shrink",
      });
      const firstSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/snapshot-partcount-shrink-qk",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "snapshot-partcount-shrink-qk",
        title: "Quantitative Knowledge",
        questionCount: 1,
        syncedAt: NOW,
      });
      const secondSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/snapshot-partcount-shrink-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "snapshot-partcount-shrink-mr",
        title: "Mathematical Reasoning",
        questionCount: 1,
        syncedAt: NOW,
      });
      const tryoutId = await ctx.db.insert("tryouts", {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "snapshot-partcount-shrink",
        label: "Snapshot Partcount Shrink",
        partCount: 2,
        totalQuestionCount: 2,
        isActive: true,
        detectedAt: NOW,
        syncedAt: NOW,
      });
      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        tryoutId,
        model: "2pl",
        status: "official",
        questionCount: 2,
        publishedAt: NOW,
      });
      const firstQuestionId = await insertExerciseQuestion(ctx, firstSetId, {
        slug: "snapshot-partcount-shrink-qk",
      });
      const secondQuestionId = await insertExerciseQuestion(ctx, secondSetId, {
        material: "mathematical-reasoning",
        slug: "snapshot-partcount-shrink-mr",
      });

      await ctx.db.insert("irtScaleVersionItems", {
        scaleVersionId,
        calibrationRunId: await ctx.db.insert("irtCalibrationRuns", {
          setId: firstSetId,
          model: "2pl",
          status: "completed",
          questionCount: 1,
          responseCount: 200,
          attemptCount: 200,
          iterationCount: 1,
          maxParameterDelta: 0.001,
          startedAt: NOW,
          updatedAt: NOW,
          completedAt: NOW,
        }),
        questionId: firstQuestionId,
        setId: firstSetId,
        difficulty: 0,
        discrimination: 1,
      });
      await ctx.db.insert("irtScaleVersionItems", {
        scaleVersionId,
        calibrationRunId: await ctx.db.insert("irtCalibrationRuns", {
          setId: secondSetId,
          model: "2pl",
          status: "completed",
          questionCount: 1,
          responseCount: 200,
          attemptCount: 200,
          iterationCount: 1,
          maxParameterDelta: 0.001,
          startedAt: NOW,
          updatedAt: NOW,
          completedAt: NOW,
        }),
        questionId: secondQuestionId,
        setId: secondSetId,
        difficulty: 0,
        discrimination: 1,
      });

      const firstSetAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/snapshot-partcount-shrink-qk",
        userId: identity.userId,
        origin: "tryout",
        mode: "simulation",
        scope: "set",
        timeLimit: 90,
        startedAt: NOW,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
        status: "completed",
        updatedAt: NOW,
        totalExercises: 1,
        answeredCount: 0,
        correctAnswers: 0,
        totalTime: 90,
        scorePercentage: 0,
      });
      const secondSetAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/snapshot-partcount-shrink-mr",
        userId: identity.userId,
        origin: "tryout",
        mode: "simulation",
        scope: "set",
        timeLimit: 90,
        startedAt: NOW,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
        status: "completed",
        updatedAt: NOW,
        totalExercises: 1,
        answeredCount: 0,
        correctAnswers: 0,
        totalTime: 90,
        scorePercentage: 0,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId,
        scaleVersionId,
        scoreStatus: "official",
        status: "expired",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 1,
            setId: firstSetId,
          },
          {
            partIndex: 1,
            partKey: "mathematical-reasoning",
            questionCount: 1,
            setId: secondSetId,
          },
        ],
        completedPartIndices: [],
        totalCorrect: 0,
        totalQuestions: 0,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "time-expired",
      });

      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
        setAttemptId: firstSetAttemptId,
        setId: firstSetId,
        theta: 0,
        thetaSE: 1,
      });
      await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 1,
        partKey: "mathematical-reasoning",
        setAttemptId: secondSetAttemptId,
        setId: secondSetId,
        theta: 0,
        thetaSE: 1,
      });

      return await buildFinalizedTryoutSnapshot(ctx.db, {
        scaleVersionId,
        tryout: {
          _id: tryoutId,
          partCount: 1,
          product: "snbt",
          totalQuestionCount: 1,
        },
        tryoutAttempt: {
          _id: tryoutAttemptId,
          completedPartIndices: [],
          partSetSnapshots: [
            {
              partIndex: 0,
              partKey: "quantitative-knowledge",
              questionCount: 1,
              setId: firstSetId,
            },
            {
              partIndex: 1,
              partKey: "mathematical-reasoning",
              questionCount: 1,
              setId: secondSetId,
            },
          ],
        },
      });
    });

    expect(result.partSnapshots).toHaveLength(2);
    expect(result.totalQuestions).toBe(2);
  });
});
