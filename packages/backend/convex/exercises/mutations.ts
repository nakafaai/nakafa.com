import { scoreExerciseAnswer } from "@repo/backend/convex/exercises/answerScoring";
import { createExerciseAttempt } from "@repo/backend/convex/exercises/helpers";
import {
  exerciseAttemptModeValidator,
  exerciseAttemptScopeValidator,
} from "@repo/backend/convex/exercises/schema";
import {
  buildFinalizedExerciseAttemptPatch,
  computeAttemptDurationSeconds,
} from "@repo/backend/convex/exercises/utils";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/helpers/auth";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { syncTryoutExerciseAttemptExpiry } from "@repo/backend/convex/tryouts/helpers/expiry";
import { finalizeTryoutPartAttempt } from "@repo/backend/convex/tryouts/helpers/scoring";
import { finalizeTryoutAttempt } from "@repo/backend/convex/tryouts/mutations/helpers";
import { ConvexError, type Infer, v } from "convex/values";
import { literals } from "convex-helpers/validators";

const completeAttemptResultValidator = v.object({
  status: literals("completed", "expired"),
  expiredAtMs: v.optional(v.number()),
});

type CompleteAttemptResult = Infer<typeof completeAttemptResultValidator>;

/**
 * Start a standalone exercise attempt for the authenticated user.
 */
export const startAttempt = mutation({
  args: {
    slug: v.string(),
    mode: exerciseAttemptModeValidator,
    scope: exerciseAttemptScopeValidator,
    exerciseNumber: v.optional(v.number()),
    totalExercises: v.number(),
    timeLimit: v.number(),
    perQuestionTimeLimit: v.optional(v.number()),
  },
  returns: vv.id("exerciseAttempts"),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;
    const now = Date.now();

    if (args.totalExercises < 1) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "totalExercises must be at least 1.",
      });
    }

    if (args.scope === "single") {
      if (!args.exerciseNumber || args.exerciseNumber < 1) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message:
            "exerciseNumber must be provided and at least 1 for single scope.",
        });
      }

      if (args.totalExercises !== 1) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: "totalExercises must be 1 for single scope.",
        });
      }
    }

    if (args.scope === "set" && args.exerciseNumber) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "exerciseNumber must be omitted for set scope.",
      });
    }

    if (args.timeLimit <= 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "timeLimit must be greater than 0 when provided.",
      });
    }

    if (args.perQuestionTimeLimit && args.perQuestionTimeLimit <= 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "perQuestionTimeLimit must be greater than 0 when provided.",
      });
    }

    const attemptId = await createExerciseAttempt(ctx, {
      slug: args.slug,
      userId,
      origin: "standalone",
      mode: args.mode,
      scope: args.scope,
      exerciseNumber: args.exerciseNumber,
      timeLimit: args.timeLimit,
      perQuestionTimeLimit: args.perQuestionTimeLimit,
      startedAt: now,
      totalExercises: args.totalExercises,
    });
    return attemptId;
  },
});

/**
 * Submit one server-scored answer inside an in-progress exercise attempt.
 */
export const submitAnswer = mutation({
  args: {
    attemptId: vv.id("exerciseAttempts"),
    exerciseNumber: v.number(),
    questionId: vv.id("exerciseQuestions"),
    selectedOptionId: v.string(),
    timeSpent: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;
    const now = Date.now();

    if (args.exerciseNumber < 1) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "exerciseNumber must be at least 1.",
      });
    }

    if (args.timeSpent < 0) {
      throw new ConvexError({
        code: "INVALID_ARGUMENT",
        message: "timeSpent cannot be negative.",
      });
    }

    const attempt = await ctx.db.get("exerciseAttempts", args.attemptId);
    if (!attempt) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Attempt not found.",
      });
    }

    if (attempt.userId !== userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this attempt.",
      });
    }

    if (attempt.status !== "in-progress") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATUS",
        message: "Attempt is not in progress.",
      });
    }

    if (attempt.scope === "single") {
      if (!attempt.exerciseNumber) {
        throw new ConvexError({
          code: "INVALID_ATTEMPT_STATE",
          message: "Single-scope attempt is missing exerciseNumber.",
        });
      }
      if (args.exerciseNumber !== attempt.exerciseNumber) {
        throw new ConvexError({
          code: "INVALID_ARGUMENT",
          message: "exerciseNumber does not match this single-scope attempt.",
        });
      }
    }

    const expiresAtMs = attempt.startedAt + attempt.timeLimit * 1000;

    const tryoutExpiry = await syncTryoutExerciseAttemptExpiry(
      ctx,
      attempt,
      now
    );
    if (tryoutExpiry.expired) {
      throw new ConvexError({
        code: "TRYOUT_EXPIRED",
        message: "This tryout has expired.",
        expiresAtMs: tryoutExpiry.expiredAtMs,
      });
    }

    if (now >= expiresAtMs) {
      throw new ConvexError({
        code: "TIME_EXPIRED",
        message: "Time has expired for this attempt.",
        expiresAtMs,
      });
    }

    const existingAnswer = await ctx.db
      .query("exerciseAnswers")
      .withIndex("attemptId_exerciseNumber", (q) =>
        q
          .eq("attemptId", args.attemptId)
          .eq("exerciseNumber", args.exerciseNumber)
      )
      .first();

    const scoredAnswer = await scoreExerciseAnswer(ctx.db, {
      attempt,
      exerciseNumber: args.exerciseNumber,
      questionId: args.questionId,
      selectedOptionId: args.selectedOptionId,
    });

    if (existingAnswer) {
      await ctx.db.patch("exerciseAnswers", existingAnswer._id, {
        questionId: scoredAnswer.questionId,
        selectedOptionId: scoredAnswer.selectedOptionId,
        textAnswer: scoredAnswer.textAnswer,
        isCorrect: scoredAnswer.isCorrect,
        timeSpent: args.timeSpent,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("exerciseAnswers", {
        attemptId: args.attemptId,
        exerciseNumber: args.exerciseNumber,
        questionId: scoredAnswer.questionId,
        selectedOptionId: scoredAnswer.selectedOptionId,
        textAnswer: scoredAnswer.textAnswer,
        isCorrect: scoredAnswer.isCorrect,
        timeSpent: args.timeSpent,
        answeredAt: now,
        updatedAt: now,
      });
    }

    return null;
  },
});

/**
 * Complete an in-progress exercise attempt.
 */
export const completeAttempt = mutation({
  args: {
    attemptId: vv.id("exerciseAttempts"),
  },
  returns: completeAttemptResultValidator,
  handler: async (ctx, args) => {
    const { appUser } = await requireAuthWithSession(ctx);
    const userId = appUser._id;
    const now = Date.now();

    const attempt = await ctx.db.get("exerciseAttempts", args.attemptId);
    if (!attempt) {
      throw new ConvexError({
        code: "ATTEMPT_NOT_FOUND",
        message: "Attempt not found.",
      });
    }

    if (attempt.userId !== userId) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "You do not have access to this attempt.",
      });
    }

    if (attempt.origin === "tryout") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATE",
        message: "Tryout attempts must be completed from the tryout flow.",
      });
    }

    if (attempt.status === "completed") {
      return { status: "completed" } satisfies CompleteAttemptResult;
    }

    if (attempt.status === "expired") {
      return { status: "expired" } satisfies CompleteAttemptResult;
    }

    if (attempt.status !== "in-progress") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATUS",
        message: "Attempt is not in progress.",
      });
    }

    if (attempt.schedulerId) {
      await ctx.scheduler.cancel(attempt.schedulerId);
    }

    const expiresAtMs = attempt.startedAt + attempt.timeLimit * 1000;

    if (now >= expiresAtMs) {
      const totalTime = computeAttemptDurationSeconds({
        startedAtMs: attempt.startedAt,
        completedAtMs: expiresAtMs,
      });

      await ctx.db.patch(
        "exerciseAttempts",
        args.attemptId,
        buildFinalizedExerciseAttemptPatch({
          completedAtMs: expiresAtMs,
          now,
          status: "expired",
          totalTime,
        })
      );

      return {
        status: "expired",
        expiredAtMs: expiresAtMs,
      } satisfies CompleteAttemptResult;
    }

    const totalTime = computeAttemptDurationSeconds({
      startedAtMs: attempt.startedAt,
      completedAtMs: now,
    });

    await ctx.db.patch(
      "exerciseAttempts",
      args.attemptId,
      buildFinalizedExerciseAttemptPatch({
        completedAtMs: now,
        now,
        status: "completed",
        totalTime,
      })
    );

    return { status: "completed" } satisfies CompleteAttemptResult;
  },
});

/**
 * Internal scheduler-safe expiry.
 *
 * This mutation is idempotent and does nothing if the attempt is no longer
 * in progress when it runs.
 */
export const expireAttemptInternal = internalMutation({
  args: {
    attemptId: vv.id("exerciseAttempts"),
    expiresAtMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const attempt = await ctx.db.get("exerciseAttempts", args.attemptId);
    if (!attempt) {
      return null;
    }

    if (attempt.status !== "in-progress") {
      return null;
    }

    const computedExpiresAtMs = attempt.startedAt + attempt.timeLimit * 1000;
    const expiresAtMs = Math.max(args.expiresAtMs, computedExpiresAtMs);

    if (now < expiresAtMs) {
      return null;
    }

    const finalTotalTime = computeAttemptDurationSeconds({
      startedAtMs: attempt.startedAt,
      completedAtMs: expiresAtMs,
    });

    await ctx.db.patch(
      "exerciseAttempts",
      args.attemptId,
      buildFinalizedExerciseAttemptPatch({
        completedAtMs: expiresAtMs,
        now,
        status: "expired",
        totalTime: finalTotalTime,
      })
    );

    if (attempt.origin !== "tryout") {
      return null;
    }

    const partAttempt = await ctx.db
      .query("tryoutPartAttempts")
      .withIndex("setAttemptId", (q) => q.eq("setAttemptId", attempt._id))
      .unique();

    if (!partAttempt) {
      return null;
    }

    await finalizeTryoutPartAttempt({
      ctx,
      finishedAtMs: expiresAtMs,
      now,
      partAttempt,
      status: "expired",
      tryoutAttemptId: partAttempt.tryoutAttemptId,
    });

    const tryoutAttempt = await ctx.db.get(
      "tryoutAttempts",
      partAttempt.tryoutAttemptId
    );

    if (!tryoutAttempt) {
      return null;
    }

    await finalizeTryoutAttempt({
      completedAtMs: expiresAtMs,
      ctx,
      now,
      tryoutAttempt,
      userId: attempt.userId,
    });

    return null;
  },
});
