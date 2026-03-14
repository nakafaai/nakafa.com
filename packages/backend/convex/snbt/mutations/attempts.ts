import { internal } from "@repo/backend/convex/_generated/api";
import { createExerciseAttempt } from "@repo/backend/convex/exercises/helpers";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { estimateThetaEAP } from "@repo/backend/convex/irt/estimation";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { localeValidator } from "@repo/backend/convex/lib/validators/contents";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  buildIrtResponses,
  computeSnbtRawScorePercentage,
  computeSnbtTryoutExpiresAtMs,
  countCorrectAnswers,
  expireTryoutAttempt,
  resolveSnbtSubjectTimeLimitSeconds,
  syncTryoutAttemptExpiry,
} from "@repo/backend/convex/snbt/helpers";
import { snbtTryoutModeValidator } from "@repo/backend/convex/snbt/schema";
import { ConvexError, v } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";

/**
 * Start a new SNBT try-out attempt or resume the latest in-progress attempt if
 * it is still inside the 24 hour completion window.
 */
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

    if (existingAttempt) {
      const tryoutExpiry = await syncTryoutAttemptExpiry(
        ctx,
        existingAttempt,
        now
      );

      if (!tryoutExpiry.expired && existingAttempt.status === "in-progress") {
        const tryoutSets = await getManyFrom(
          ctx.db,
          "snbtTryoutSets",
          "tryoutId_subjectIndex",
          tryout._id,
          "tryoutId"
        );

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

    const expiresAtMs = computeSnbtTryoutExpiresAtMs(now);

    await ctx.scheduler.runAfter(
      expiresAtMs - now,
      internal.snbt.mutations.attempts.expireTryoutAttemptInternal,
      {
        tryoutAttemptId,
        expiresAtMs,
      }
    );

    return {
      tryoutAttemptId,
      subjectCount: tryout.subjectCount,
      firstSubjectIndex: 0,
    };
  },
});

/**
 * Start or resume a single subject inside an SNBT try-out.
 *
 * Subject exercise attempts reuse the shared `exerciseAttempts` table with
 * `origin: "snbt"` so the generic exercise engine stays the single source of
 * truth for timers and answers.
 */
export const startSubject = mutation({
  args: {
    tryoutAttemptId: vv.id("snbtTryoutAttempts"),
    subjectIndex: v.number(),
    timeLimit: v.optional(v.number()),
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

    const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

    if (tryoutExpiry.expired) {
      throw new ConvexError({
        code: "TRYOUT_EXPIRED",
        message: "This tryout has expired.",
        expiresAtMs: tryoutExpiry.expiredAtMs,
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

      if (!existingSetAttempt) {
        throw new ConvexError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Subject attempt exists without its exercise attempt.",
        });
      }

      return {
        setAttemptId: existingSubjectAttempt.setAttemptId,
        setId: tryoutSet.setId,
        questionCount: set.questionCount,
      };
    }

    const timeLimit = resolveSnbtSubjectTimeLimitSeconds({
      mode: tryoutAttempt.mode,
      questionCount: set.questionCount,
      requestedTimeLimit: args.timeLimit,
    });

    const setAttemptId = await createExerciseAttempt(ctx, {
      slug: set.slug,
      userId,
      origin: "snbt",
      mode: tryoutAttempt.mode,
      scope: "set",
      timeLimit,
      startedAt: now,
      totalExercises: set.questionCount,
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

/**
 * Finalize one SNBT subject, store subject-level theta, and update the parent
 * try-out's raw aggregates.
 */
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

    const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

    if (tryoutExpiry.expired) {
      throw new ConvexError({
        code: "TRYOUT_EXPIRED",
        message: "This tryout has expired.",
        expiresAtMs: tryoutExpiry.expiredAtMs,
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

    if (tryoutAttempt.completedSubjectIndices.includes(args.subjectIndex)) {
      const answers = await ctx.db
        .query("exerciseAnswers")
        .withIndex("attemptId_exerciseNumber", (q) =>
          q.eq("attemptId", subjectAttempt.setAttemptId)
        )
        .collect();

      return {
        theta: subjectAttempt.theta,
        thetaSE: subjectAttempt.thetaSE,
        rawScore: countCorrectAnswers(answers),
        totalQuestions: setAttempt.totalExercises,
      };
    }

    if (setAttempt.status !== "completed" && setAttempt.status !== "expired") {
      await ctx.db.patch("exerciseAttempts", subjectAttempt.setAttemptId, {
        status: "completed",
        completedAt: now,
        lastActivityAt: now,
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

    const itemResponses = buildIrtResponses({ answers, itemParamsRecords });

    const { theta, se } = estimateThetaEAP(itemResponses);
    const rawScore = countCorrectAnswers(answers);

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

/**
 * Finalize a try-out after all subjects are complete.
 *
 * Official leaderboard updates are delegated to an internal mutation so the
 * leaderboard policy remains centralized in one backend path.
 */
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
      const rawScorePercentage = computeSnbtRawScorePercentage(tryoutAttempt);
      return {
        status: "completed" as const,
        theta: tryoutAttempt.theta,
        irtScore: tryoutAttempt.irtScore,
        rawScorePercentage,
      };
    }

    if (tryoutAttempt.status === "expired") {
      const rawScorePercentage = computeSnbtRawScorePercentage(tryoutAttempt);
      return {
        status: "expired" as const,
        theta: tryoutAttempt.theta,
        irtScore: tryoutAttempt.irtScore,
        rawScorePercentage,
      };
    }

    if (tryoutAttempt.status === "abandoned") {
      const rawScorePercentage = computeSnbtRawScorePercentage(tryoutAttempt);
      return {
        status: "abandoned" as const,
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

    const tryoutExpiry = await syncTryoutAttemptExpiry(ctx, tryoutAttempt, now);

    if (tryoutExpiry.expired) {
      const rawScorePercentage = computeSnbtRawScorePercentage(tryoutAttempt);

      return {
        status: "expired" as const,
        theta: tryoutAttempt.theta,
        irtScore: tryoutAttempt.irtScore,
        rawScorePercentage,
      };
    }

    const tryout = await ctx.db.get("snbtTryouts", tryoutAttempt.tryoutId);

    if (!tryout) {
      throw new ConvexError({
        code: "TRYOUT_NOT_FOUND",
        message: "Tryout not found.",
      });
    }

    const rawScorePercentage = computeSnbtRawScorePercentage(tryoutAttempt);

    if (tryoutAttempt.completedSubjectIndices.length < tryout.subjectCount) {
      return {
        status: "in-progress" as const,
        theta: tryoutAttempt.theta,
        irtScore: tryoutAttempt.irtScore,
        rawScorePercentage,
      };
    }

    const subjectAttempts = await getManyFrom(
      ctx.db,
      "snbtTryoutSubjectAttempts",
      "tryoutAttemptId_subjectIndex",
      args.tryoutAttemptId,
      "tryoutAttemptId"
    );

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

    const allResponses = subjectAttemptData.flatMap((subjectData) =>
      buildIrtResponses(subjectData)
    );

    const { theta, se } = estimateThetaEAP(allResponses);
    const irtScore = Math.round(600 + theta * 100);
    const clampedIRTScore = Math.max(200, Math.min(1000, irtScore));

    await ctx.db.patch("snbtTryoutAttempts", args.tryoutAttemptId, {
      status: "completed",
      completedAt: now,
      theta,
      thetaSE: se,
      irtScore: clampedIRTScore,
      lastActivityAt: now,
    });

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

/**
 * Scheduled expiry for the 24 hour SNBT try-out window.
 *
 * The mutation is idempotent so delayed or duplicate scheduler execution does
 * not corrupt try-out state.
 */
export const expireTryoutAttemptInternal = internalMutation({
  args: {
    tryoutAttemptId: vv.id("snbtTryoutAttempts"),
    expiresAtMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const tryoutAttempt = await ctx.db.get(
      "snbtTryoutAttempts",
      args.tryoutAttemptId
    );

    if (!tryoutAttempt || tryoutAttempt.status !== "in-progress") {
      return null;
    }

    const computedExpiresAtMs = computeSnbtTryoutExpiresAtMs(
      tryoutAttempt.startedAt
    );

    if (args.expiresAtMs < computedExpiresAtMs || now < computedExpiresAtMs) {
      return null;
    }

    await expireTryoutAttempt(ctx, tryoutAttempt, now);

    return null;
  },
});
