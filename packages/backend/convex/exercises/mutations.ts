import { internal } from "@repo/backend/convex/_generated/api";
import {
  exerciseAttemptMode,
  exerciseAttemptScope,
} from "@repo/backend/convex/exercises/schema";
import { computeAttemptDurationSeconds } from "@repo/backend/convex/exercises/utils";
import { internalMutation, mutation } from "@repo/backend/convex/functions";
import { requireAuthWithSession } from "@repo/backend/convex/lib/authHelpers";
import { ConvexError, v } from "convex/values";

/**
 * Starts a new exercise attempt for the authenticated user.
 *
 * @param slug - The unique identifier/path of the exercise set (e.g., "math/algebra/set-1").
 * @param mode - The mode of the attempt ("practice" or "simulation").
 * @param scope - The scope of the attempt ("set" or "single").
 * @param totalExercises - The total number of exercises in the set.
 * @param timeLimit - Optional time limit for the entire set in seconds.
 * @param perQuestionTimeLimit - Optional time limit per question in seconds.
 * @returns The ID of the newly created or existing attempt.
 */
export const startAttempt = mutation({
  args: {
    slug: v.string(),
    mode: exerciseAttemptMode,
    scope: exerciseAttemptScope,
    exerciseNumber: v.optional(v.number()),
    totalExercises: v.number(),
    timeLimit: v.number(),
    perQuestionTimeLimit: v.optional(v.number()),
  },
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

    const attemptId = await ctx.db.insert("exerciseAttempts", {
      slug: args.slug,
      userId,
      mode: args.mode,
      scope: args.scope,
      exerciseNumber: args.scope === "single" ? args.exerciseNumber : undefined,
      timeLimit: args.timeLimit,
      perQuestionTimeLimit: args.perQuestionTimeLimit,
      startedAt: now,
      lastActivityAt: now,
      updatedAt: now,
      status: "in-progress",
      totalExercises: args.totalExercises,
      answeredCount: 0,
      correctAnswers: 0,
      totalTime: 0,
      scorePercentage: 0,
    });

    // NOTE: totalTime starts at 0 and accumulates through submitAnswer calls.
    // Final duration is calculated from wall-clock time when attempt completes.

    if (args.timeLimit > 0) {
      const expiresAtMs = now + args.timeLimit * 1000;
      const schedulerId = await ctx.scheduler.runAfter(
        args.timeLimit * 1000,
        internal.exercises.mutations.expireAttemptInternal,
        {
          attemptId,
          expiresAtMs,
        }
      );
      await ctx.db.patch("exerciseAttempts", attemptId, { schedulerId });
    }

    return attemptId;
  },
});

/**
 * Submits an answer for a specific exercise within an attempt.
 *
 * BUSINESS LOGIC: Creates or updates an answer record for a question.
 *
 * AGGREGATE UPDATES: All attempt aggregates (answeredCount, correctAnswers,
 * totalTime, scorePercentage) are managed by the trigger system in `functions.ts`.
 * This mutation only handles the answer record - triggers handle the rest.
 *
 * ARCHITECTURE BENEFITS:
 * - Single source of truth for aggregates (trigger system)
 * - Retry-safe (triggers use newDoc/oldDoc pattern)
 * - Clean separation of concerns (mutation = operations, triggers = aggregates)
 * - No race conditions or double-updates
 *
 * `timeSpent` is the total time spent on this question (seconds).
 * If the user re-submits an answer, the trigger calculates the delta correctly.
 *
 * @param attemptId - The ID of the attempt.
 * @param exerciseNumber - The 1-based index of the exercise in the set.
 * @param selectedOptionId - The ID of the selected option (for multiple choice).
 * @param textAnswer - The text answer (for fill-in-the-blank/essay).
 * @param isCorrect - Whether the answer is correct (validated by frontend/backend logic before calling this).
 * @param timeSpent - Time spent on this specific question in seconds.
 */
export const submitAnswer = mutation({
  args: {
    attemptId: v.id("exerciseAttempts"),
    exerciseNumber: v.number(),
    selectedOptionId: v.optional(v.string()),
    textAnswer: v.optional(v.string()),
    isCorrect: v.boolean(),
    timeSpent: v.number(),
  },
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

    if (args.exerciseNumber > attempt.totalExercises) {
      // Need to patch the attempt, it might that the totalExercises is increased
      // by the admin.
      await ctx.db.patch("exerciseAttempts", args.attemptId, {
        totalExercises: args.exerciseNumber,
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

    // Create or update the answer record.
    // All aggregate updates (answeredCount, correctAnswers, totalTime, scorePercentage)
    // are handled by the trigger system in functions.ts.
    if (existingAnswer) {
      await ctx.db.patch("exerciseAnswers", existingAnswer._id, {
        selectedOptionId: args.selectedOptionId,
        textAnswer: args.textAnswer,
        isCorrect: args.isCorrect,
        timeSpent: args.timeSpent,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("exerciseAnswers", {
        attemptId: args.attemptId,
        exerciseNumber: args.exerciseNumber,
        selectedOptionId: args.selectedOptionId,
        textAnswer: args.textAnswer,
        isCorrect: args.isCorrect,
        timeSpent: args.timeSpent,
        answeredAt: now,
        updatedAt: now,
      });
    }
  },
});

/**
 * Completes an in-progress exercise attempt.
 *
 * This is the authoritative end-of-session event used by UI (Finish button
 * or timer expiry flow).
 *
 * Final duration is calculated from wall-clock time (completedAt - startedAt)
 * to capture all time periods including idle time. See `computeAttemptDurationSeconds`
 * in exercises/utils.ts for detailed rationale.
 *
 * Idempotent behavior:
 * - If attempt is already completed, it returns `{ status: "completed" }`.
 */
export const completeAttempt = mutation({
  args: {
    attemptId: v.id("exerciseAttempts"),
  },
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

    if (attempt.schedulerId) {
      await ctx.scheduler.cancel(attempt.schedulerId);
    }

    if (attempt.status === "completed") {
      return { status: "completed" as const };
    }

    if (attempt.status === "expired") {
      return { status: "expired" as const };
    }

    if (attempt.status === "abandoned") {
      return { status: "abandoned" as const };
    }

    if (attempt.status !== "in-progress") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATUS",
        message: "Attempt is not in progress.",
      });
    }

    const expiresAtMs = attempt.startedAt + attempt.timeLimit * 1000;

    const finalTotalTime = computeAttemptDurationSeconds({
      startedAtMs: attempt.startedAt,
      completedAtMs: now,
    });

    if (now >= expiresAtMs) {
      await ctx.db.patch("exerciseAttempts", args.attemptId, {
        status: "expired",
        completedAt: expiresAtMs,
        lastActivityAt: now,
        updatedAt: now,
        totalTime: finalTotalTime,
      });

      return { status: "expired" as const, expiredAtMs: expiresAtMs };
    }

    await ctx.db.patch("exerciseAttempts", args.attemptId, {
      status: "completed",
      completedAt: now,
      lastActivityAt: now,
      updatedAt: now,
      totalTime: finalTotalTime,
    });

    return { status: "completed" as const };
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
    attemptId: v.id("exerciseAttempts"),
    expiresAtMs: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const attempt = await ctx.db.get("exerciseAttempts", args.attemptId);
    if (!attempt) {
      return;
    }

    if (attempt.status !== "in-progress") {
      return;
    }

    const computedExpiresAtMs = attempt.startedAt + attempt.timeLimit * 1000;
    const expiresAtMs = Math.max(args.expiresAtMs, computedExpiresAtMs);

    if (now < expiresAtMs) {
      return;
    }

    const finalTotalTime = computeAttemptDurationSeconds({
      startedAtMs: attempt.startedAt,
      completedAtMs: expiresAtMs,
    });

    await ctx.db.patch("exerciseAttempts", args.attemptId, {
      status: "expired",
      completedAt: expiresAtMs,
      lastActivityAt: now,
      updatedAt: now,
      totalTime: finalTotalTime,
    });
  },
});

/**
 * Abandons an in-progress attempt.
 *
 * Use cases:
 * - user explicitly quits
 * - client decides an attempt is stale (e.g. inactive for days) and wants to reset UX
 */
export const abandonAttempt = mutation({
  args: {
    attemptId: v.id("exerciseAttempts"),
  },
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

    if (attempt.status === "abandoned") {
      return { status: "abandoned" as const };
    }

    if (attempt.status === "completed") {
      return { status: "completed" as const };
    }

    if (attempt.status === "expired") {
      return { status: "expired" as const };
    }

    if (attempt.status !== "in-progress") {
      throw new ConvexError({
        code: "INVALID_ATTEMPT_STATUS",
        message: "Attempt is not in progress.",
      });
    }

    const finalTotalTime = computeAttemptDurationSeconds({
      startedAtMs: attempt.startedAt,
      completedAtMs: now,
    });

    await ctx.db.patch("exerciseAttempts", args.attemptId, {
      status: "abandoned",
      completedAt: now,
      lastActivityAt: now,
      updatedAt: now,
      totalTime: finalTotalTime,
    });

    return { status: "abandoned" as const };
  },
});
