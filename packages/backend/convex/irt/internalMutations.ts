import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  adjustCalibrationCacheAttemptCount,
  calibrationCacheStatsRebuildProgressValidator,
  prepareCalibrationCacheForSet,
} from "@repo/backend/convex/irt/helpers/cache";
import {
  cleanupCalibrationQueueEntriesBatch,
  cleanupScalePublicationQueueEntriesBatch,
  getPendingCalibrationQueueQuery,
  startCalibrationRunWorkflow,
} from "@repo/backend/convex/irt/helpers/queue";
import {
  getCalibrationAttemptCacheLimit,
  IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
  IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE,
  IRT_CALIBRATION_QUEUE_BATCH_SIZE,
  IRT_CALIBRATION_RESPONSE_BACKFILL_BATCH_SIZE,
  IRT_MAX_CALIBRATION_STALENESS_MS,
  IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION,
  IRT_QUEUE_CLEANUP_BATCH_SIZE,
  IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE,
} from "@repo/backend/convex/irt/policy";
import { publishTryoutScaleVersionIfNeeded } from "@repo/backend/convex/irt/scales/publish";
import { irtCalibrationResultValidator } from "@repo/backend/convex/irt/validators";
import { irtCalibrationSyncWorkpool } from "@repo/backend/convex/irt/workpool";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import { ConvexError, v } from "convex/values";
import { asyncMap } from "convex-helpers";
import { getAll, getManyFrom } from "convex-helpers/server/relationships";

const backfillCalibrationResponsesResultValidator = v.object({
  isDone: v.boolean(),
  processedCount: v.number(),
});

const rebuildCalibrationCacheStatsResultValidator = v.object({
  isDone: v.boolean(),
  processedCount: v.number(),
});

const MAX_CALIBRATION_ATTEMPT_DUPLICATES = 100;
const MAX_AFFECTED_TRYOUTS_PER_SET = 100;

/**
 * Syncs the denormalized calibration responses for one exercise attempt.
 */
export const syncCalibrationResponsesForAttempt = internalMutation({
  args: {
    attemptId: vv.id("exerciseAttempts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const existingAttempts = await ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_attemptId", (q) => q.eq("attemptId", args.attemptId))
      .take(MAX_CALIBRATION_ATTEMPT_DUPLICATES + 1);

    if (existingAttempts.length > MAX_CALIBRATION_ATTEMPT_DUPLICATES) {
      throw new ConvexError({
        code: "IRT_CALIBRATION_ATTEMPT_DUPLICATE_LIMIT_EXCEEDED",
        message: "Too many cached calibration rows exist for one attempt.",
      });
    }
    const removedAttemptCounts = new Map<Id<"exerciseSets">, number>();

    for (const calibrationAttempt of existingAttempts) {
      const nextCount =
        (removedAttemptCounts.get(calibrationAttempt.setId) ?? 0) + 1;
      removedAttemptCounts.set(calibrationAttempt.setId, nextCount);
    }

    for (const calibrationAttempt of existingAttempts) {
      await ctx.db.delete("irtCalibrationAttempts", calibrationAttempt._id);
    }

    for (const [setId, removedCount] of removedAttemptCounts) {
      const didAdjustStats = await adjustCalibrationCacheAttemptCount(ctx, {
        setId,
        delta: -removedCount,
        updatedAt: now,
      });

      if (didAdjustStats) {
        continue;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
        { setId }
      );
    }

    const attempt = await ctx.db.get("exerciseAttempts", args.attemptId);

    if (
      !attempt ||
      attempt.scope !== "set" ||
      attempt.mode !== "simulation" ||
      attempt.status !== "completed"
    ) {
      return null;
    }

    const answers = await getManyFrom(
      ctx.db,
      "exerciseAnswers",
      "attemptId_exerciseNumber",
      args.attemptId,
      "attemptId"
    );
    const scoredAnswers = answers.flatMap((answer) => {
      if (answer.questionId === undefined) {
        return [];
      }

      return [
        {
          isCorrect: answer.isCorrect,
          questionId: answer.questionId,
        },
      ];
    });

    if (scoredAnswers.length === 0) {
      return null;
    }

    const questions = await getAll(
      ctx.db,
      "exerciseQuestions",
      scoredAnswers.map((answer) => answer.questionId)
    );
    const firstQuestion = questions[0];

    if (!firstQuestion) {
      return null;
    }

    const setId = firstQuestion.setId;
    const responses = scoredAnswers.map((answer, index) => {
      const question = questions[index];

      if (!question) {
        throw new ConvexError({
          code: "IRT_QUESTION_NOT_FOUND",
          message: "Calibration response is missing its exercise question.",
        });
      }

      if (question.setId !== setId) {
        throw new ConvexError({
          code: "IRT_MULTIPLE_SETS_IN_ATTEMPT",
          message: "Calibration attempt contains answers from multiple sets.",
        });
      }

      return {
        questionId: question._id,
        isCorrect: answer.isCorrect,
      };
    });

    await ctx.db.insert("irtCalibrationAttempts", {
      setId,
      attemptId: args.attemptId,
      responses,
    });

    const didAdjustStats = await adjustCalibrationCacheAttemptCount(ctx, {
      setId,
      delta: 1,
      updatedAt: now,
    });

    if (!didAdjustStats) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
        { setId }
      );
    }

    return null;
  },
});

/** Rebuilds one set's calibration-cache stats in bounded pages. */
export const rebuildCalibrationCacheStatsForSet = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    progress: v.optional(calibrationCacheStatsRebuildProgressValidator),
    setId: vv.id("exerciseSets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const set = await ctx.db.get("exerciseSets", args.setId);

    if (!set) {
      return null;
    }

    const page = await ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId", (q) => q.eq("setId", args.setId))
      .paginate({
        cursor: args.cursor ?? null,
        numItems: IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
      });

    const progress = args.progress ?? { attemptCount: 0 };
    progress.attemptCount += page.page.length;

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
        {
          cursor: page.continueCursor,
          progress,
          setId: args.setId,
        }
      );

      return null;
    }

    const cacheStats = await ctx.db
      .query("irtCalibrationCacheStats")
      .withIndex("by_setId", (q) => q.eq("setId", args.setId))
      .unique();

    if (progress.attemptCount === 0) {
      if (cacheStats) {
        await ctx.db.delete("irtCalibrationCacheStats", cacheStats._id);
      }

      return null;
    }

    if (cacheStats) {
      await ctx.db.patch("irtCalibrationCacheStats", cacheStats._id, {
        attemptCount: progress.attemptCount,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("irtCalibrationCacheStats", {
        setId: args.setId,
        attemptCount: progress.attemptCount,
        updatedAt: Date.now(),
      });
    }

    if (
      progress.attemptCount <=
      getCalibrationAttemptCacheLimit(set.questionCount)
    ) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.trimCalibrationCacheForSet,
      { setId: args.setId }
    );

    return null;
  },
});

/**
 * Backfills denormalized calibration responses for existing completed attempts.
 */
export const backfillCalibrationResponsesPage = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: backfillCalibrationResponsesResultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("exerciseAttempts")
      .withIndex("scope_mode_status_startedAt", (q) =>
        q.eq("scope", "set").eq("mode", "simulation").eq("status", "completed")
      )
      .paginate({
        cursor: args.cursor ?? null,
        numItems: IRT_CALIBRATION_RESPONSE_BACKFILL_BATCH_SIZE,
      });

    for (const attempt of page.page) {
      await irtCalibrationSyncWorkpool.enqueueMutation(
        ctx,
        internal.irt.internalMutations.syncCalibrationResponsesForAttempt,
        {
          attemptId: attempt._id,
        }
      );
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.internalMutations.backfillCalibrationResponsesPage,
        {
          cursor: page.continueCursor,
        }
      );
    }

    return {
      isDone: page.isDone,
      processedCount: page.page.length,
    };
  },
});

/** Schedules bounded calibration-cache stats rebuilds for all exercise sets. */
export const rebuildCalibrationCacheStatsPage = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  returns: rebuildCalibrationCacheStatsResultValidator,
  handler: async (ctx, args) => {
    const page = await ctx.db.query("exerciseSets").paginate({
      cursor: args.cursor ?? null,
      numItems: IRT_CALIBRATION_CACHE_STATS_REBUILD_BATCH_SIZE,
    });

    for (const set of page.page) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
        { setId: set._id }
      );
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.internalMutations.rebuildCalibrationCacheStatsPage,
        { cursor: page.continueCursor }
      );
    }

    return {
      isDone: page.isDone,
      processedCount: page.page.length,
    };
  },
});

/** Deletes the oldest cached calibration attempts until one set is back in budget. */
export const trimCalibrationCacheForSet = internalMutation({
  args: {
    setId: vv.id("exerciseSets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const set = await ctx.db.get("exerciseSets", args.setId);

    if (!set) {
      return null;
    }

    const cacheStats = await ctx.db
      .query("irtCalibrationCacheStats")
      .withIndex("by_setId", (q) => q.eq("setId", args.setId))
      .unique();

    if (!cacheStats) {
      await ctx.scheduler.runAfter(
        0,
        internal.irt.internalMutations.rebuildCalibrationCacheStatsForSet,
        { setId: args.setId }
      );

      return null;
    }

    const cacheLimit = getCalibrationAttemptCacheLimit(set.questionCount);

    if (cacheStats.attemptCount <= cacheLimit) {
      return null;
    }

    const trimCount = Math.min(
      cacheStats.attemptCount - cacheLimit,
      IRT_CALIBRATION_CACHE_TRIM_BATCH_SIZE
    );
    const oldestAttempts = await ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId", (q) => q.eq("setId", args.setId))
      .take(trimCount);

    if (oldestAttempts.length === 0) {
      await ctx.db.delete("irtCalibrationCacheStats", cacheStats._id);
      return null;
    }

    for (const calibrationAttempt of oldestAttempts) {
      await ctx.db.delete("irtCalibrationAttempts", calibrationAttempt._id);
    }

    const nextAttemptCount = Math.max(
      0,
      cacheStats.attemptCount - oldestAttempts.length
    );

    if (nextAttemptCount === 0) {
      await ctx.db.delete("irtCalibrationCacheStats", cacheStats._id);
      return null;
    }

    await ctx.db.patch("irtCalibrationCacheStats", cacheStats._id, {
      attemptCount: nextAttemptCount,
      updatedAt: Date.now(),
    });

    if (nextAttemptCount <= cacheLimit) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.trimCalibrationCacheForSet,
      args
    );

    return null;
  },
});

/**
 * Drain a bounded batch of queued set calibrations.
 */
export const drainCalibrationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const queueEntries = await ctx.db
      .query("irtCalibrationQueue")
      .withIndex("by_enqueuedAt")
      .take(
        IRT_CALIBRATION_QUEUE_BATCH_SIZE *
          IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION
      );

    const distinctSetIds = [
      ...new Set(queueEntries.map((entry) => entry.setId)),
    ].slice(0, IRT_CALIBRATION_QUEUE_BATCH_SIZE);

    await asyncMap(distinctSetIds, async (setId) => {
      const cacheIsWithinLimit = await prepareCalibrationCacheForSet(
        ctx,
        setId
      );

      if (!cacheIsWithinLimit) {
        return null;
      }

      const [latestCompletedRun, latestRun] = await Promise.all([
        ctx.db
          .query("irtCalibrationRuns")
          .withIndex("by_setId_and_status_and_startedAt", (q) =>
            q.eq("setId", setId).eq("status", "completed")
          )
          .order("desc")
          .first(),
        ctx.db
          .query("irtCalibrationRuns")
          .withIndex("by_setId_and_startedAt", (q) => q.eq("setId", setId))
          .order("desc")
          .first(),
      ]);

      if (latestRun?.status === "running") {
        return null;
      }

      const lastSuccessfulRunStartedAt = latestCompletedRun?.startedAt;
      const pendingQueueEntries = await getPendingCalibrationQueueQuery(ctx, {
        lastSuccessfulRunStartedAt,
        setId,
      }).take(IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION);

      if (pendingQueueEntries.length === 0) {
        if (lastSuccessfulRunStartedAt !== undefined) {
          await ctx.scheduler.runAfter(
            0,
            internal.irt.internalMutations.cleanupCalibrationQueueEntries,
            {
              setId,
              throughAt: lastSuccessfulRunStartedAt,
            }
          );
        }

        return null;
      }

      const oldestPendingQueueEntry = pendingQueueEntries[0];

      if (!oldestPendingQueueEntry) {
        return null;
      }

      const hasEnoughCompletedAttempts =
        pendingQueueEntries.length >=
        IRT_MIN_COMPLETED_ATTEMPTS_FOR_RECALIBRATION;
      const isStale =
        now - oldestPendingQueueEntry.enqueuedAt >=
        IRT_MAX_CALIBRATION_STALENESS_MS;

      if (!(hasEnoughCompletedAttempts || isStale)) {
        return null;
      }

      const calibrationRunId = await startCalibrationRunWorkflow(ctx, setId);

      if (!calibrationRunId) {
        return null;
      }

      return calibrationRunId;
    });

    return null;
  },
});

/**
 * Persist calibrated item parameters and mark the run completed.
 */
export const completeCalibrationRun = internalMutation({
  args: {
    calibrationRunId: vv.id("irtCalibrationRuns"),
    result: irtCalibrationResultValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    const run = await ctx.db.get("irtCalibrationRuns", args.calibrationRunId);

    if (!run) {
      throw new ConvexError({
        code: "IRT_CALIBRATION_RUN_NOT_FOUND",
        message: "Calibration run not found.",
      });
    }

    const existingParams = await ctx.db
      .query("exerciseItemParameters")
      .withIndex("by_setId", (q) => q.eq("setId", run.setId))
      .take(run.questionCount + 1);

    if (existingParams.length > run.questionCount) {
      throw new ConvexError({
        code: "IRT_ITEM_PARAMETER_COUNT_EXCEEDED",
        message:
          "Exercise item parameter count exceeds the set question count.",
      });
    }
    const existingParamsByQuestionId = new Map(
      existingParams.map((params) => [params.questionId, params])
    );

    await asyncMap(args.result.items, async (item) => {
      const existingItemParams = existingParamsByQuestionId.get(
        item.questionId
      );

      const nextValues = {
        setId: run.setId,
        difficulty: item.difficulty,
        discrimination: item.discrimination,
        responseCount: item.responseCount,
        correctRate: item.correctRate,
        calibratedAt: now,
        calibrationStatus: item.calibrationStatus,
        calibrationRunId: args.calibrationRunId,
      };

      if (existingItemParams) {
        await ctx.db.patch(
          "exerciseItemParameters",
          existingItemParams._id,
          nextValues
        );
      } else {
        await ctx.db.insert("exerciseItemParameters", {
          questionId: item.questionId,
          ...nextValues,
        });
      }
    });

    await ctx.db.patch("irtCalibrationRuns", args.calibrationRunId, {
      status: "completed",
      responseCount: args.result.responseCount,
      attemptCount: args.result.attemptCount,
      questionCount: args.result.questionCount,
      iterationCount: args.result.iterationCount,
      maxParameterDelta: args.result.maxParameterDelta,
      completedAt: now,
      updatedAt: now,
      error: undefined,
    });

    const affectedTryoutSets = await ctx.db
      .query("tryoutPartSets")
      .withIndex("setId", (q) => q.eq("setId", run.setId))
      .take(MAX_AFFECTED_TRYOUTS_PER_SET + 1);

    if (affectedTryoutSets.length > MAX_AFFECTED_TRYOUTS_PER_SET) {
      throw new ConvexError({
        code: "IRT_AFFECTED_TRYOUT_LIMIT_EXCEEDED",
        message: "Too many tryouts reference one calibrated set.",
      });
    }

    await asyncMap(
      [...new Set(affectedTryoutSets.map((tryoutSet) => tryoutSet.tryoutId))],
      async (tryoutId) => {
        const existingQueueEntry = await ctx.db
          .query("irtScalePublicationQueue")
          .withIndex("by_tryoutId_and_enqueuedAt", (q) =>
            q.eq("tryoutId", tryoutId)
          )
          .first();

        if (!existingQueueEntry) {
          await ctx.db.insert("irtScalePublicationQueue", {
            tryoutId,
            enqueuedAt: now,
          });
        }

        return null;
      }
    );

    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.cleanupCalibrationQueueEntries,
      {
        setId: run.setId,
        throughAt: run.startedAt,
      }
    );

    return null;
  },
});

/**
 * Mark a calibration run as failed and keep it eligible for retry.
 */
export const failCalibrationRun = internalMutation({
  args: {
    calibrationRunId: vv.id("irtCalibrationRuns"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("irtCalibrationRuns", args.calibrationRunId);

    if (!run) {
      throw new ConvexError({
        code: "IRT_CALIBRATION_RUN_NOT_FOUND",
        message: "Calibration run not found.",
      });
    }

    await ctx.db.patch("irtCalibrationRuns", args.calibrationRunId, {
      status: "failed",
      error: args.error,
      updatedAt: Date.now(),
    });

    const existingQueueEntry = await ctx.db
      .query("irtCalibrationQueue")
      .withIndex("by_setId_and_enqueuedAt", (q) => q.eq("setId", run.setId))
      .first();

    if (!existingQueueEntry) {
      await ctx.db.insert("irtCalibrationQueue", {
        setId: run.setId,
        enqueuedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Deletes processed calibration queue rows in bounded batches.
 */
export const cleanupCalibrationQueueEntries = internalMutation({
  args: {
    setId: vv.id("exerciseSets"),
    throughAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletedCount = await cleanupCalibrationQueueEntriesBatch(ctx, args);

    if (deletedCount < IRT_QUEUE_CLEANUP_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.cleanupCalibrationQueueEntries,
      args
    );

    return null;
  },
});

/**
 * Deletes processed scale-publication queue rows in bounded batches.
 */
export const cleanupScalePublicationQueueEntries = internalMutation({
  args: {
    tryoutId: vv.id("tryouts"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const deletedCount = await cleanupScalePublicationQueueEntriesBatch(
      ctx,
      args.tryoutId
    );

    if (deletedCount < IRT_QUEUE_CLEANUP_BATCH_SIZE) {
      return null;
    }

    await ctx.scheduler.runAfter(
      0,
      internal.irt.internalMutations.cleanupScalePublicationQueueEntries,
      args
    );

    return null;
  },
});

/**
 * Drain a bounded batch of queued tryout scale publications.
 */
export const drainScalePublicationQueue = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const queueEntries = await ctx.db
      .query("irtScalePublicationQueue")
      .withIndex("by_enqueuedAt")
      .take(IRT_SCALE_PUBLICATION_QUEUE_BATCH_SIZE);

    const distinctTryoutIds = [
      ...new Set(queueEntries.map((entry) => entry.tryoutId)),
    ];

    for (const tryoutId of distinctTryoutIds) {
      const result = await publishTryoutScaleVersionIfNeeded(ctx, tryoutId);

      if (result.kind === "not-ready") {
        continue;
      }

      await ctx.scheduler.runAfter(
        0,
        internal.irt.internalMutations.cleanupScalePublicationQueueEntries,
        {
          tryoutId,
        }
      );
    }

    return null;
  },
});
