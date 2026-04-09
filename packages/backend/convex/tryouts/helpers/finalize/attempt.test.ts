import { seedAuthenticatedUser } from "@repo/backend/convex/test.helpers";
import { finalizeTryoutAttempt } from "@repo/backend/convex/tryouts/helpers/finalize/attempt";
import { getTryoutReportScore } from "@repo/backend/convex/tryouts/helpers/reporting";
import {
  ATTEMPT_WINDOW_MS,
  createTryoutTestConvex,
  insertTryoutSkeleton,
  NOW,
} from "@repo/backend/convex/tryouts/test.helpers";
import { describe, expect, it } from "vitest";

describe("tryouts/helpers/finalize/attempt", () => {
  it("returns status-specific finalized tryout summaries across attempt states", async () => {
    const t = createTryoutTestConvex();
    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "finalize-reporting",
      });
      const tryout = await insertTryoutSkeleton(ctx, "2026-reporting-finalize");
      const completedAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "completed",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [0],
        attemptNumber: 1,
        totalCorrect: 12,
        totalQuestions: 20,
        theta: 1.5,
        thetaSE: 0.3,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "submitted",
      });
      const expiredAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "expired",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        attemptNumber: 2,
        totalCorrect: 4,
        totalQuestions: 20,
        theta: -1.25,
        thetaSE: 0.6,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: NOW,
        endReason: "time-expired",
      });
      const inProgressAttemptId = await ctx.db.insert("tryoutAttempts", {
        userId: identity.userId,
        tryoutId: tryout.tryoutId,
        scaleVersionId: tryout.scaleVersionId,
        scoreStatus: "official",
        status: "in-progress",
        partSetSnapshots: [
          {
            partIndex: 0,
            partKey: "quantitative-knowledge",
            questionCount: 20,
            setId: tryout.setId,
          },
        ],
        completedPartIndices: [],
        attemptNumber: 3,
        totalCorrect: 0,
        totalQuestions: 5,
        theta: 0.75,
        thetaSE: 0.9,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });
      await ctx.db.insert("tryoutLeaderboardEntries", {
        tryoutId: tryout.tryoutId,
        userId: identity.userId,
        leaderboardNamespace: "snbt:id:2026",
        theta: 1.5,
        thetaSE: 0.3,
        rawScore: 60,
        completedAt: NOW,
        attemptId: completedAttemptId,
      });
      const completedAttempt = await ctx.db.get(
        "tryoutAttempts",
        completedAttemptId
      );
      const expiredAttempt = await ctx.db.get(
        "tryoutAttempts",
        expiredAttemptId
      );
      const inProgressAttempt = await ctx.db.get(
        "tryoutAttempts",
        inProgressAttemptId
      );

      if (!(completedAttempt && expiredAttempt && inProgressAttempt)) {
        throw new Error("Expected seeded tryout attempts to exist");
      }

      return {
        completed: await finalizeTryoutAttempt({
          ctx,
          now: NOW,
          tryoutAttempt: completedAttempt,
          userId: identity.userId,
        }),
        expired: await finalizeTryoutAttempt({
          ctx,
          now: NOW,
          tryoutAttempt: expiredAttempt,
          userId: identity.userId,
        }),
        inProgress: await finalizeTryoutAttempt({
          ctx,
          now: NOW,
          tryoutAttempt: inProgressAttempt,
          userId: identity.userId,
        }),
      };
    });

    expect(result.completed).toEqual({
      status: "completed",
      isOfficial: true,
      theta: 1.5,
      irtScore: getTryoutReportScore("snbt", 1.5),
      rawScorePercentage: 60,
    });
    expect(result.expired).toEqual({
      status: "expired",
      isOfficial: false,
      theta: -1.25,
      irtScore: getTryoutReportScore("snbt", -1.25),
      rawScorePercentage: 20,
    });
    expect(result.inProgress).toEqual({
      status: "in-progress",
      isOfficial: false,
      theta: 0.75,
      irtScore: getTryoutReportScore("snbt", 0.75),
      rawScorePercentage: 0,
    });
  });

  it("keeps an attempt in progress when only the live tryout partCount shrinks", async () => {
    const t = createTryoutTestConvex();
    const result = await t.mutation(async (ctx) => {
      const identity = await seedAuthenticatedUser(ctx, {
        now: NOW,
        suffix: "finalize-partcount-shrink",
      });
      const firstSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/quantitative-knowledge/try-out/2026/finalize-partcount-shrink-qk",
        category: "high-school",
        type: "snbt",
        material: "quantitative-knowledge",
        exerciseType: "try-out",
        setName: "finalize-partcount-shrink-qk",
        title: "Quantitative Knowledge",
        questionCount: 1,
        syncedAt: NOW,
      });
      const secondSetId = await ctx.db.insert("exerciseSets", {
        locale: "id",
        slug: "exercises/high-school/snbt/mathematical-reasoning/try-out/2026/finalize-partcount-shrink-mr",
        category: "high-school",
        type: "snbt",
        material: "mathematical-reasoning",
        exerciseType: "try-out",
        setName: "finalize-partcount-shrink-mr",
        title: "Mathematical Reasoning",
        questionCount: 1,
        syncedAt: NOW,
      });
      const tryoutId = await ctx.db.insert("tryouts", {
        catalogPosition: 1,
        product: "snbt",
        locale: "id",
        cycleKey: "2026",
        slug: "finalize-partcount-shrink",
        label: "Finalize Partcount Shrink",
        partCount: 2,
        totalQuestionCount: 2,
        isActive: true,
        detectedAt: NOW,
        syncedAt: NOW,
      });

      await ctx.db.insert("tryoutPartSets", {
        tryoutId,
        setId: firstSetId,
        partIndex: 0,
        partKey: "quantitative-knowledge",
      });
      await ctx.db.insert("tryoutPartSets", {
        tryoutId,
        setId: secondSetId,
        partIndex: 1,
        partKey: "mathematical-reasoning",
      });

      const scaleVersionId = await ctx.db.insert("irtScaleVersions", {
        tryoutId,
        model: "2pl",
        status: "official",
        questionCount: 2,
        publishedAt: NOW,
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
        completedPartIndices: [0],
        attemptNumber: 1,
        totalCorrect: 0,
        totalQuestions: 1,
        theta: 0,
        thetaSE: 1,
        startedAt: NOW,
        expiresAt: NOW + ATTEMPT_WINDOW_MS,
        lastActivityAt: NOW,
        completedAt: null,
        endReason: null,
      });
      const tryoutAttempt = await ctx.db.get("tryoutAttempts", tryoutAttemptId);

      if (!tryoutAttempt) {
        throw new Error("Expected tryout attempt to exist");
      }

      await ctx.db.patch("tryouts", tryoutId, {
        partCount: 1,
        totalQuestionCount: 1,
      });

      return await finalizeTryoutAttempt({
        ctx,
        now: NOW,
        tryoutAttempt,
        userId: identity.userId,
      });
    });

    expect(result.status).toBe("in-progress");
    expect(result.isOfficial).toBe(false);
  });
});
