import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

const RESET_BATCH_SIZE = 500;

const batchDeleteResultValidator = v.object({
  deleted: v.number(),
  hasMore: v.boolean(),
});

type ResettableTableName =
  | "articleContents"
  | "articleReferences"
  | "authors"
  | "contentAuthors"
  | "exerciseAnswers"
  | "exerciseAttempts"
  | "exerciseChoices"
  | "exerciseItemParameters"
  | "exerciseQuestions"
  | "exerciseSets"
  | "irtCalibrationAttempts"
  | "irtCalibrationQueue"
  | "irtCalibrationRuns"
  | "irtScalePublicationQueue"
  | "irtScaleVersionItems"
  | "irtScaleVersions"
  | "subjectSections"
  | "subjectTopics"
  | "tryoutAttempts"
  | "tryoutLeaderboardEntries"
  | "tryoutPartAttempts"
  | "tryoutPartSets"
  | "tryouts"
  | "userTryoutStats";

async function deleteBatchFromTable(
  ctx: MutationCtx,
  tableName: ResettableTableName
) {
  const docs = await ctx.db.query(tableName).take(RESET_BATCH_SIZE);
  let deleted = 0;

  for (const doc of docs) {
    await ctx.db.delete(tableName, doc._id);
    deleted++;
  }

  const hasMore = (await ctx.db.query(tableName).first()) !== null;

  return { deleted, hasMore };
}

export const deleteContentAuthorsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "contentAuthors"),
});

export const deleteArticleReferencesBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "articleReferences"),
});

export const deleteExerciseChoicesBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "exerciseChoices"),
});

export const deleteExerciseAnswersBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "exerciseAnswers"),
});

export const deleteTryoutPartAttemptsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "tryoutPartAttempts"),
});

export const deleteTryoutLeaderboardEntriesBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "tryoutLeaderboardEntries"),
});

export const deleteUserTryoutStatsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "userTryoutStats"),
});

export const deleteIrtScalePublicationQueueBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "irtScalePublicationQueue"),
});

export const deleteIrtScaleVersionItemsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "irtScaleVersionItems"),
});

export const deleteExerciseItemParametersBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "exerciseItemParameters"),
});

export const deleteIrtCalibrationQueueBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "irtCalibrationQueue"),
});

export const deleteIrtCalibrationAttemptsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "irtCalibrationAttempts"),
});

export const deleteExerciseAttemptsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "exerciseAttempts"),
});

export const deleteTryoutAttemptsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "tryoutAttempts"),
});

export const deleteTryoutPartSetsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "tryoutPartSets"),
});

export const deleteIrtScaleVersionsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "irtScaleVersions"),
});

export const deleteIrtCalibrationRunsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "irtCalibrationRuns"),
});

export const deleteTryoutsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "tryouts"),
});

export const deleteExerciseQuestionsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "exerciseQuestions"),
});

export const deleteExerciseSetsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "exerciseSets"),
});

export const deleteSubjectSectionsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "subjectSections"),
});

export const deleteSubjectTopicsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "subjectTopics"),
});

export const deleteArticlesBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "articleContents"),
});

export const deleteAuthorsBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => deleteBatchFromTable(ctx, "authors"),
});
