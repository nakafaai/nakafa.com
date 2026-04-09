import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { finalizeTryoutPartAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/part";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertExerciseQuestion,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/helpers/finalize/part", () => {
  it("finalizes a started part using the persisted set id and exercise total", async () => {
    const t = createTryoutTestConvex();

    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "finalize-part",
      });
      const tryout = await insertTryoutSkeleton(ctx, "finalize-part", 1);
      const questionId = await insertExerciseQuestion(ctx, tryout.setId, {
        slug: "finalize-part",
      });
      const calibrationRunId = await ctx.db.insert("irtCalibrationRuns", {
        setId: tryout.setId,
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
        scaleVersionId: tryout.scaleVersionId,
        calibrationRunId,
        questionId,
        setId: tryout.setId,
        difficulty: 0,
        discrimination: 1,
      });

      const setAttemptId = await ctx.db.insert("exerciseAttempts", {
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/finalize-part",
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
        answeredCount: 1,
        correctAnswers: 1,
        totalTime: 0,
        scorePercentage: 100,
      });
      const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 1,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        attemptNumber: 1,
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
      const partAttemptId = await ctx.db.insert("tryoutPartAttempts", {
        tryoutAttemptId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
        setAttemptId,
        setId: tryout.setId,
        theta: 0,
        thetaSE: 1,
      });

      await ctx.db.insert("exerciseAnswers", {
        attemptId: setAttemptId,
        exerciseNumber: 1,
        questionId,
        isCorrect: true,
        timeSpent: 45,
        answeredAt: NOW,
        updatedAt: NOW,
      });

      const partAttempt = await ctx.db.get("tryoutPartAttempts", partAttemptId);

      if (!partAttempt) {
        throw new Error("Expected tryout part attempt to exist");
      }

      const finalizedPart = await finalizeTryoutPartAttempt({
        ctx,
        finishedAtMs: NOW + 45_000,
        now: NOW + 45_000,
        partAttempt,
        status: "completed",
        tryoutAttemptId,
      });
      const storedPartAttempt = await ctx.db.get(
        "tryoutPartAttempts",
        partAttemptId
      );
      const storedTryoutAttempt = await ctx.db.get(
        "tryoutAttempts",
        tryoutAttemptId
      );
      return {
        finalizedPart,
        storedPartAttempt,
        storedTryoutAttempt,
      };
    });

    expect(result.finalizedPart.totalQuestions).toBe(1);
    expect(result.finalizedPart.rawScore).toBe(1);
    expect(result.storedTryoutAttempt?.completedPartIndices).toEqual([0]);
    expect(result.storedPartAttempt?.theta).toBe(result.finalizedPart.theta);
  });
});
