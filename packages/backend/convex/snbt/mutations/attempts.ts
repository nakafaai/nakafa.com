import { internal } from "@repo/backend/convex/_generated/api";
import { mutation } from "@repo/backend/convex/functions";
import type { Response } from "@repo/backend/convex/irt/estimation";
import { estimateThetaEAP } from "@repo/backend/convex/irt/estimation";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { snbtTryoutModeValidator } from "@repo/backend/convex/snbt/schema";
import { ConvexError, v } from "convex/values";

export const startTryout = mutation({
  args: {
    locale: localeValidator,
    tryoutSlug: v.string(),
    mode: snbtTryoutModeValidator,
  },
  returns: v.object({
    tryoutAttemptId: vv.id("snbtTryoutAttempts"),
    subjectCount: v.number(),
    firstSubjectIndex: v.number(),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;
    const now = Date.now();

    const tryout = await ctx.db
      .query("snbtTryouts")
      .withIndex("locale_slug", (q) =>
        q.eq("locale", args.locale).eq("slug", args.tryoutSlug)
      )
      .first();

    if (!tryout) {
      throw new ConvexError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      });
    }

    if (!tryout.isActive) {
      throw new ConvexError({
        code: "TRYOUT_INACTIVE",
        message: "This tryout is not currently active.",
      });
    }

    const existingAttempt = await ctx.db
      .query("snbtTryoutAttempts")
      .withIndex("userId_tryoutId", (q) =>
        q.eq("userId", userId).eq("tryoutId", tryout._id)
      )
      .order("desc")
      .first();

    if (existingAttempt && existingAttempt.status === "in-progress") {
      const tryoutSets = await ctx.db
        .query("snbtTryoutSets")
        .withIndex("tryoutId", (q) => q.eq("tryoutId", tryout._id))
        .collect();

      const firstIncompleteIndex = tryoutSets.find(
        (ts) =>
          !existingAttempt.completedSubjectIndices.includes(ts.subjectIndex)
      )?.subjectIndex;

      return {
        tryoutAttemptId: existingAttempt._id,
        subjectCount: tryout.subjectCount,
        firstSubjectIndex: firstIncompleteIndex ?? 0,
      };
    }

    const tryoutAttemptId = await ctx.db.insert("snbtTryoutAttempts", {
      userId,
      tryoutId: tryout._id,
      mode: args.mode,
      status: "in-progress",
      completedSubjectIndices: [],
      totalCorrect: 0,
      totalQuestions: 0,
      theta: 0,
      thetaSE: 1,
      irtScore: 600,
      startedAt: now,
      lastActivityAt: now,
    });

    return {
      tryoutAttemptId,
      subjectCount: tryout.subjectCount,
      firstSubjectIndex: 0,
    };
  },
});

export const startSubject = mutation({
  args: {
    tryoutAttemptId: vv.id("snbtTryoutAttempts"),
    subjectIndex: v.number(),
    timeLimit: v.number(),
  },
  returns: v.object({
    setAttemptId: vv.id("exerciseAttempts"),
    setId: vv.id("exerciseSets"),
    questionCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;
    const now = Date.now();

    if (args.timeLimit <= 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "timeLimit must be greater than 0.",
      });
    }

    const tryoutAttempt = await ctx.db.get(
      "snbtTryoutAttempts",
      args.tryoutAttemptId
    );
    if (!tryoutAttempt) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      });
    }

    if (tryoutAttempt.userId !== userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this tryout attempt.",
      });
    }

    if (tryoutAttempt.status !== "in-progress") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATUS",
        message: "Tryout attempt is not in progress.",
      });
    }

    if (tryoutAttempt.completedSubjectIndices.includes(args.subjectIndex)) {
      throw new ConvexError({
        code: "SUBJECT_ALREADY_COMPLETED",
        message: "This subject has already been completed.",
      });
    }

    const tryoutSet = await ctx.db
      .query("snbtTryoutSets")
      .withIndex("tryoutId_subjectIndex", (q) =>
        q
          .eq("tryoutId", tryoutAttempt.tryoutId)
          .eq("subjectIndex", args.subjectIndex)
      )
      .first();

    if (!tryoutSet) {
      throw new ConvexError({
        code: "SUBJECT_NOT_FOUND",
        message: "Subject not found in this tryout.",
      });
    }

    const set = await ctx.db.get("exerciseSets", tryoutSet.setId);
    if (!set) {
      throw new ConvexError({
        code: "SET_NOT_FOUND",
        message: "Exercise set not found.",
      });
    }

    const existingSubjectAttempt = await ctx.db
      .query("snbtTryoutSubjectAttempts")
      .withIndex("tryoutAttemptId_subjectIndex", (q) =>
        q
          .eq("tryoutAttemptId", args.tryoutAttemptId)
          .eq("subjectIndex", args.subjectIndex)
      )
      .first();

    if (existingSubjectAttempt) {
      const existingSetAttempt = await ctx.db.get(
        "exerciseAttempts",
        existingSubjectAttempt.setAttemptId
      );
      if (existingSetAttempt && existingSetAttempt.status === "in-progress") {
        return {
          setAttemptId: existingSubjectAttempt.setAttemptId,
          setId: tryoutSet.setId,
          questionCount: set.questionCount,
        };
      }
    }

    const setAttemptId = await ctx.db.insert("exerciseAttempts", {
      slug: set.slug,
      userId,
      mode: tryoutAttempt.mode === "simulation" ? "simulation" : "practice",
      scope: "set",
      timeLimit: args.timeLimit,
      startedAt: now,
      lastActivityAt: now,
      updatedAt: now,
      status: "in-progress",
      totalExercises: set.questionCount,
      answeredCount: 0,
      correctAnswers: 0,
      totalTime: 0,
      scorePercentage: 0,
    });

    await ctx.db.insert("snbtTryoutSubjectAttempts", {
      tryoutAttemptId: args.tryoutAttemptId,
      subjectIndex: args.subjectIndex,
      setAttemptId,
      setId: tryoutSet.setId,
      theta: 0,
      thetaSE: 1,
    });

    await ctx.db.patch("snbtTryoutAttempts", args.tryoutAttemptId, {
      lastActivityAt: now,
    });

    return {
      setAttemptId,
      setId: tryoutSet.setId,
      questionCount: set.questionCount,
    };
  },
});

export const completeSubject = mutation({
  args: {
    tryoutAttemptId: vv.id("snbtTryoutAttempts"),
    subjectIndex: v.number(),
  },
  returns: v.object({
    theta: v.number(),
    thetaSE: v.number(),
    rawScore: v.number(),
    totalQuestions: v.number(),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;
    const now = Date.now();

    const tryoutAttempt = await ctx.db.get(
      "snbtTryoutAttempts",
      args.tryoutAttemptId
    );
    if (!tryoutAttempt) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      });
    }

    if (tryoutAttempt.userId !== userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this tryout attempt.",
      });
    }

    if (tryoutAttempt.status !== "in-progress") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATUS",
        message: "Tryout attempt is not in progress.",
      });
    }

    const subjectAttempt = await ctx.db
      .query("snbtTryoutSubjectAttempts")
      .withIndex("tryoutAttemptId_subjectIndex", (q) =>
        q
          .eq("tryoutAttemptId", args.tryoutAttemptId)
          .eq("subjectIndex", args.subjectIndex)
      )
      .first();

    if (!subjectAttempt) {
      throw new ConvexError({
        code: "SUBJECT_ATTEMPT_NOT_FOUND",
        message: "Subject attempt not found.",
      });
    }

    const setAttempt = await ctx.db.get(
      "exerciseAttempts",
      subjectAttempt.setAttemptId
    );
    if (!setAttempt) {
      throw new ConvexError({
        code: "SET_ATTEMPT_NOT_FOUND",
        message: "Exercise set attempt not found.",
      });
    }

    if (setAttempt.status !== "completed" && setAttempt.status !== "expired") {
      await ctx.db.patch("exerciseAttempts", subjectAttempt.setAttemptId, {
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
    }

    const answers = await ctx.db
      .query("exerciseAnswers")
      .withIndex("attemptId_exerciseNumber", (q) =>
        q.eq("attemptId", subjectAttempt.setAttemptId)
      )
      .collect();

    const itemParamsRecords = await ctx.db
      .query("exerciseItemParameters")
      .withIndex("setId", (q) => q.eq("setId", subjectAttempt.setId))
      .collect();

    const itemParamsMap = new Map(
      itemParamsRecords.map((ip) => [ip.questionId, ip])
    );

    const itemResponses: Response[] = [];

    for (const answer of answers) {
      if (answer.questionId === undefined) {
        continue;
      }
      const params = itemParamsMap.get(answer.questionId);
      if (params) {
        itemResponses.push({
          correct: answer.isCorrect,
          params: {
            difficulty: params.difficulty,
            discrimination: params.discrimination,
            guessing: params.guessing,
          },
        });
      }
    }

    const { theta, se } = estimateThetaEAP(itemResponses);
    const rawScore = answers.filter((a) => a.isCorrect).length;

    await ctx.db.patch("snbtTryoutSubjectAttempts", subjectAttempt._id, {
      theta,
      thetaSE: se,
    });

    const totalCorrect = tryoutAttempt.totalCorrect + rawScore;
    const totalQuestions =
      tryoutAttempt.totalQuestions + setAttempt.totalExercises;
    const completedSubjectIndices = [
      ...tryoutAttempt.completedSubjectIndices,
      args.subjectIndex,
    ];

    await ctx.db.patch("snbtTryoutAttempts", args.tryoutAttemptId, {
      completedSubjectIndices,
      totalCorrect,
      totalQuestions,
      lastActivityAt: now,
    });

    return {
      theta,
      thetaSE: se,
      rawScore,
      totalQuestions: setAttempt.totalExercises,
    };
  },
});

export const completeTryout = mutation({
  args: {
    tryoutAttemptId: vv.id("snbtTryoutAttempts"),
  },
  returns: v.object({
    status: v.union(
      v.literal("in-progress"),
      v.literal("completed"),
      v.literal("expired"),
      v.literal("abandoned")
    ),
    theta: v.number(),
    irtScore: v.number(),
    rawScorePercentage: v.number(),
  }),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;
    const now = Date.now();

    const tryoutAttempt = await ctx.db.get(
      "snbtTryoutAttempts",
      args.tryoutAttemptId
    );
    if (!tryoutAttempt) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Tryout attempt not found.",
      });
    }

    if (tryoutAttempt.userId !== userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this tryout attempt.",
      });
    }

    if (tryoutAttempt.status === "completed") {
      const rawScorePercentage =
        tryoutAttempt.totalQuestions > 0
          ? (tryoutAttempt.totalCorrect / tryoutAttempt.totalQuestions) * 100
          : 0;
      return {
        status: "completed" as const,
        theta: tryoutAttempt.theta,
        irtScore: tryoutAttempt.irtScore,
        rawScorePercentage,
      };
    }

    if (tryoutAttempt.status !== "in-progress") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATUS",
        message: "Tryout attempt is not in progress.",
      });
    }

    const tryout = await ctx.db.get("snbtTryouts", tryoutAttempt.tryoutId);

    const subjectAttempts = await ctx.db
      .query("snbtTryoutSubjectAttempts")
      .withIndex("tryoutAttemptId", (q) =>
        q.eq("tryoutAttemptId", args.tryoutAttemptId)
      )
      .collect();

    const subjectAttemptData = await Promise.all(
      subjectAttempts.map(async (sa) => {
        const [answers, itemParamsRecords] = await Promise.all([
          ctx.db
            .query("exerciseAnswers")
            .withIndex("attemptId_exerciseNumber", (q) =>
              q.eq("attemptId", sa.setAttemptId)
            )
            .collect(),
          ctx.db
            .query("exerciseItemParameters")
            .withIndex("setId", (q) => q.eq("setId", sa.setId))
            .collect(),
        ]);
        return { answers, itemParamsRecords };
      })
    );

    const allResponses: Response[] = [];

    for (const { answers, itemParamsRecords } of subjectAttemptData) {
      const itemParamsMap = new Map(
        itemParamsRecords.map((ip) => [ip.questionId, ip])
      );

      for (const answer of answers) {
        if (answer.questionId === undefined) {
          continue;
        }
        const params = itemParamsMap.get(answer.questionId);
        if (params) {
          allResponses.push({
            correct: answer.isCorrect,
            params: {
              difficulty: params.difficulty,
              discrimination: params.discrimination,
              guessing: params.guessing,
            },
          });
        }
      }
    }

    const { theta, se } = estimateThetaEAP(allResponses);
    const irtScore = Math.round(600 + theta * 100);
    const clampedIRTScore = Math.max(200, Math.min(1000, irtScore));
    const rawScorePercentage =
      tryoutAttempt.totalQuestions > 0
        ? (tryoutAttempt.totalCorrect / tryoutAttempt.totalQuestions) * 100
        : 0;

    await ctx.db.patch("snbtTryoutAttempts", args.tryoutAttemptId, {
      status: "completed",
      completedAt: now,
      theta,
      thetaSE: se,
      irtScore: clampedIRTScore,
      lastActivityAt: now,
    });

    const statsRecord = await ctx.db
      .query("userSnbtStats")
      .withIndex("userId_locale", (q) =>
        q.eq("userId", userId).eq("locale", tryout?.locale ?? "id")
      )
      .first();

    const locale = tryout?.locale ?? "id";

    if (statsRecord) {
      const newTotal = statsRecord.totalTryoutsCompleted + 1;
      const newAverageTheta =
        (statsRecord.averageTheta * statsRecord.totalTryoutsCompleted + theta) /
        newTotal;
      const newAverageRawScore =
        (statsRecord.averageRawScore * statsRecord.totalTryoutsCompleted +
          rawScorePercentage) /
        newTotal;

      await ctx.db.patch("userSnbtStats", statsRecord._id, {
        totalTryoutsCompleted: newTotal,
        averageTheta: newAverageTheta,
        bestTheta: Math.max(statsRecord.bestTheta, theta),
        averageRawScore: newAverageRawScore,
        bestRawScore: Math.max(statsRecord.bestRawScore, rawScorePercentage),
        lastTryoutAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("userSnbtStats", {
        userId,
        locale,
        totalTryoutsCompleted: 1,
        averageTheta: theta,
        averageThetaSE: se,
        bestTheta: theta,
        averageRawScore: rawScorePercentage,
        bestRawScore: rawScorePercentage,
        lastTryoutAt: now,
        updatedAt: now,
      });
    }

    await ctx.scheduler.runAfter(
      0,
      internal.snbt.mutations.leaderboard.updateLeaderboard,
      {
        tryoutAttemptId: args.tryoutAttemptId,
      }
    );

    return {
      status: "completed" as const,
      theta,
      irtScore: clampedIRTScore,
      rawScorePercentage,
    };
  },
});
