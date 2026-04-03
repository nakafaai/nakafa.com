import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { expireTryoutAttempt } from "@repo/backend/convex/tryouts/helpers/expiry";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertExerciseQuestion,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/helpers/expiry", () => {
  it("expires started parts using snapshot length when live partCount shrinks", async () => {
    const t = createTryoutTestConvex();

    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "expire-partcount-shrink",
      });
      const firstSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/expire-partcount-shrink-qk",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "expire-partcount-shrink-qk",
        title: "Quantitative Knowledge",
        questionCount: 1,
        syncedAt: NOW,
      });
      const secondSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/expire-partcount-shrink-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "expire-partcount-shrink-mr",
        title: "Mathematical Reasoning",
        questionCount: 1,
        syncedAt: NOW,
      });
      const tryoutId = await ctx.db.insert("tryouts", {
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "expire-partcount-shrink",
        label: "Expire Partcount Shrink",
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
        slug: "expire-partcount-shrink-qk",
      });
      const secondQuestionId = await insertExerciseQuestion(ctx, secondSetId, {
        material: "mathematical-reasoning",
        slug: "expire-partcount-shrink-mr",
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
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/expire-partcount-shrink-qk",
        userId: identity.userId,
        origin: "tryout",
        mode: "simulation",
        scope: "set",
        timeLimit: 90,
        startedAt: NOW,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
        status: "in-progress",
        updatedAt: NOW,
        totalExercises: 1,
        answeredCount: 0,
        correctAnswers: 0,
        totalTime: 0,
        scorePercentage: 0,
      });
      const secondSetAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/expire-partcount-shrink-mr",
        userId: identity.userId,
        origin: "tryout",
        mode: "simulation",
        scope: "set",
        timeLimit: 90,
        startedAt: NOW,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
        status: "in-progress",
        updatedAt: NOW,
        totalExercises: 1,
        answeredCount: 0,
        correctAnswers: 0,
        totalTime: 0,
        scorePercentage: 0,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId,
        scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
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
        completedAt: null,
        endReason: null,
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
      await ctx.db.patch("tryouts", tryoutId, {
        partCount: 1,
        totalQuestionCount: 1,
      });

      const tryoutAttempt = await ctx.db.get("tryoutAttempts", tryoutAttemptId);

      if (!tryoutAttempt) {
        throw new Error("Expected tryout attempt to exist");
      }

      const expiredAtMs = await expireTryoutAttempt(
        ctx,
        tryoutAttempt,
        NOW + ATTEMPT_WINDOW_MS
      );
      const storedAttempt = await ctx.db.get("tryoutAttempts", tryoutAttemptId);

      return {
        expiredAtMs,
        storedAttempt,
      };
    });

    expect(result.expiredAtMs).toBe(NOW + ATTEMPT_WINDOW_MS);
    expect(result.storedAttempt?.status).toBe("expired");
    expect(result.storedAttempt?.completedPartIndices).toEqual([0, 1]);
  });
});
