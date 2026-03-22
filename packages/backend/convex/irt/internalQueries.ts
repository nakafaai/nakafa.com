import { internalQuery } from "@repo/backend/convex/_generated/server";
import { getCalibrationAttemptCacheLimit } from "@repo/backend/convex/irt/policy";
import { irtCalibratedItemValidator } from "@repo/backend/convex/irt/validators";
import { vv } from "@repo/backend/convex/lib/validators/vv";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, type Infer, v } from "convex/values";
import { getManyFrom } from "convex-helpers/server/relationships";

const MAX_IRT_CACHE_INTEGRITY_SETS = 1000;

export const calibrationQuestionValidator = v.object({
  questionId: vv.id("exerciseQuestions"),
  number: v.number(),
});

export const calibrationResponseValidator = v.object({
  attemptId: vv.id("exerciseAttempts"),
  isCorrect: v.boolean(),
  questionId: vv.id("exerciseQuestions"),
});
export type CalibrationResponse = Infer<typeof calibrationResponseValidator>;

export const calibrationQuestionsForSetResultValidator = v.object({
  existingParams: v.array(irtCalibratedItemValidator),
  questions: v.array(calibrationQuestionValidator),
});

export const calibrationResponsesPageResultValidator =
  paginationResultValidator(calibrationResponseValidator);

const calibrationCacheIntegrityResultValidator = v.object({
  missingStatsSetCount: v.number(),
  oversizedSetCount: v.number(),
});

/**
 * Load the questions in one exercise set together with any previously stored
 * item parameters used as seeds for the next calibration run.
 */
export const getCalibrationQuestionsForSet = internalQuery({
  args: {
    setId: vv.id("exerciseSets"),
  },
  returns: calibrationQuestionsForSetResultValidator,
  handler: async (ctx, args) => {
    const questions = await getManyFrom(
      ctx.db,
      "exerciseQuestions",
      "setId",
      args.setId
    );
    const existingParams = await getManyFrom(
      ctx.db,
      "exerciseItemParameters",
      "by_setId",
      args.setId,
      "setId"
    );

    return {
      questions: [...questions]
        .sort((a, b) => a.number - b.number)
        .map((question) => ({
          questionId: question._id,
          number: question.number,
        })),
      existingParams: existingParams.map((params) => ({
        questionId: params.questionId,
        difficulty: params.difficulty,
        discrimination: params.discrimination,
        responseCount: params.responseCount,
        correctRate: params.correctRate,
        calibrationStatus: params.calibrationStatus,
      })),
    };
  },
});

/**
 * Load one page of scored responses from completed simulation set attempts.
 */
export const getCalibrationResponsesPageForSet = internalQuery({
  args: {
    setId: vv.id("exerciseSets"),
    paginationOpts: paginationOptsValidator,
  },
  returns: calibrationResponsesPageResultValidator,
  handler: async (ctx, args) => {
    const responsePage = await ctx.db
      .query("irtCalibrationAttempts")
      .withIndex("by_setId_and_attemptId", (q) => q.eq("setId", args.setId))
      .paginate(args.paginationOpts);

    return {
      page: responsePage.page.flatMap((attempt) =>
        attempt.responses.map((response) => ({
          attemptId: attempt.attemptId,
          isCorrect: response.isCorrect,
          questionId: response.questionId,
        }))
      ),
      isDone: responsePage.isDone,
      continueCursor: responsePage.continueCursor,
    };
  },
});

/** Returns whether any set still has missing or oversized calibration cache state. */
export const getCalibrationCacheIntegrity = internalQuery({
  args: {},
  returns: calibrationCacheIntegrityResultValidator,
  handler: async (ctx) => {
    const sets = await ctx.db
      .query("exerciseSets")
      .take(MAX_IRT_CACHE_INTEGRITY_SETS + 1);

    if (sets.length > MAX_IRT_CACHE_INTEGRITY_SETS) {
      throw new ConvexError({
        code: "IRT_CACHE_INTEGRITY_SET_LIMIT_EXCEEDED",
        message:
          "Too many exercise sets to scan calibration cache integrity safely.",
      });
    }

    let missingStatsSetCount = 0;
    let oversizedSetCount = 0;

    for (const set of sets) {
      const cacheStats = await ctx.db
        .query("irtCalibrationCacheStats")
        .withIndex("by_setId", (q) => q.eq("setId", set._id))
        .unique();

      if (!cacheStats) {
        const cachedAttempt = await ctx.db
          .query("irtCalibrationAttempts")
          .withIndex("by_setId", (q) => q.eq("setId", set._id))
          .first();

        if (cachedAttempt) {
          missingStatsSetCount += 1;
        }

        continue;
      }

      if (
        cacheStats.attemptCount <=
        getCalibrationAttemptCacheLimit(set.questionCount)
      ) {
        continue;
      }

      oversizedSetCount += 1;
    }

    return {
      missingStatsSetCount,
      oversizedSetCount,
    };
  },
});
