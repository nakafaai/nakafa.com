import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { syncTryoutAttemptAggregates } from "@repo/backend/convex/tryouts/helpers/finalize/aggregates";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertExerciseQuestion,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

async function insertSingleQuestionCompletedAttempt(
  ctx: MutationCtx,
  {
    scaleVersionId,
    setId,
    slug,
    tryoutId,
    userId,
  }: {
    scaleVersionId: Id<"irtScaleVersions">;
    setId: Id<"exerciseSets">;
    slug: string;
    tryoutId: Id<"tryouts">;
    userId: Id<"users">;
  }
) {
  const questionId = await insertExerciseQuestion(ctx, setId, { slug });
  const setAttemptId = await ctx.db.insert("exerciseAttempts", {
    slug: `exercises/high-school/snbt/quantitative-knowledge/try-out/2026/${slug}`,
    userId,
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
    correctAnswers: 0,
    totalTime: 90,
    scorePercentage: 0,
  });
  const tryoutAttemptId = await ctx.db.insert("tryoutAttempts", {
    userId,
    tryoutId,
    scaleVersionId,
    scoreStatus: "official",
    status: "completed",
    partSetSnapshots: [
      {
        partIndex: 0,
        partKey: "quantitative-knowledge",
        questionCount: 1,
        setId,
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

  await ctx.db.insert("exerciseAnswers", {
    attemptId: setAttemptId,
    exerciseNumber: 1,
    questionId,
    isCorrect: false,
    timeSpent: 90,
    answeredAt: NOW,
    updatedAt: NOW,
  });
  await ctx.db.insert("tryoutPartAttempts", {
    tryoutAttemptId,
    partIndex: 0,
    partKey: "quantitative-knowledge",
    setAttemptId,
    setId,
    theta: 0,
    thetaSE: 1,
  });
  await ctx.db.insert("irtScaleVersionItems", {
    scaleVersionId,
    calibrationRunId: await ctx.db.insert("irtCalibrationRuns", {
      setId,
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
    questionId,
    setId,
    difficulty: 0,
    discrimination: 1,
  });

  return { tryoutAttemptId };
}

describe("tryouts/helpers/finalize/aggregates", () => {
  it("syncs finalized tryout aggregates without writing a persisted irtScore", async () => {
    const t = createTryoutTestConvex();
    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "aggregate-sync",
      });
      const tryout = await insertTryoutSkeleton(
        ctx,
        "2026-reporting-aggregate",
        1
      );
      const { tryoutAttemptId } = await insertSingleQuestionCompletedAttempt(
        ctx,
        {
          scaleVersionId: tryout.scaleVersionId,
          setId: tryout.setId,
          slug: "2026-reporting-aggregate",
          tryoutId: tryout.tryoutId,
          userId: identity.userId,
        }
      );

      const aggregate = await syncTryoutAttemptAggregates({
        completedAtMs: NOW,
        ctx,
        now: NOW,
        status: "completed",
        tryoutAttemptId,
      });
      const storedAttempt = await ctx.db.get("tryoutAttempts", tryoutAttemptId);

      return {
        aggregate,
        storedAttempt,
      };
    });

    expect(result.aggregate.irtScore).toBe(
      getTryoutReportScore("snbt", result.aggregate.theta)
    );

    if (!result.storedAttempt) {
      return;
    }

    expect("irtScore" in result.storedAttempt).toBe(false);
  });
});
