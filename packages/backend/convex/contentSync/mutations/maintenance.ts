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
  | "irtCalibrationCacheStats"
  | "irtCalibrationQueue"
  | "irtCalibrationRuns"
  | "irtScaleQualityChecks"
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

function makeBatchDeleteMutation(tableName: ResettableTableName) {
  return internalMutation({
    args: {},
    returns: batchDeleteResultValidator,
    handler: async (ctx) => deleteBatchFromTable(ctx, tableName),
  });
}

export const deleteContentAuthorsBatch =
  makeBatchDeleteMutation("contentAuthors");
export const deleteArticleReferencesBatch =
  makeBatchDeleteMutation("articleReferences");
export const deleteExerciseChoicesBatch =
  makeBatchDeleteMutation("exerciseChoices");
export const deleteExerciseAnswersBatch =
  makeBatchDeleteMutation("exerciseAnswers");
export const deleteTryoutPartAttemptsBatch =
  makeBatchDeleteMutation("tryoutPartAttempts");
export const deleteTryoutLeaderboardEntriesBatch = makeBatchDeleteMutation(
  "tryoutLeaderboardEntries"
);
export const deleteUserTryoutStatsBatch =
  makeBatchDeleteMutation("userTryoutStats");
export const deleteIrtScalePublicationQueueBatch = makeBatchDeleteMutation(
  "irtScalePublicationQueue"
);
export const deleteIrtScaleVersionItemsBatch = makeBatchDeleteMutation(
  "irtScaleVersionItems"
);
export const deleteExerciseItemParametersBatch = makeBatchDeleteMutation(
  "exerciseItemParameters"
);
export const deleteIrtCalibrationQueueBatch = makeBatchDeleteMutation(
  "irtCalibrationQueue"
);
export const deleteIrtCalibrationAttemptsBatch = makeBatchDeleteMutation(
  "irtCalibrationAttempts"
);
export const deleteIrtCalibrationCacheStatsBatch = makeBatchDeleteMutation(
  "irtCalibrationCacheStats"
);
export const deleteIrtScaleQualityChecksBatch = makeBatchDeleteMutation(
  "irtScaleQualityChecks"
);
export const deleteExerciseAttemptsBatch =
  makeBatchDeleteMutation("exerciseAttempts");
export const deleteTryoutAttemptsBatch =
  makeBatchDeleteMutation("tryoutAttempts");
export const deleteTryoutPartSetsBatch =
  makeBatchDeleteMutation("tryoutPartSets");
export const deleteIrtScaleVersionsBatch =
  makeBatchDeleteMutation("irtScaleVersions");
export const deleteIrtCalibrationRunsBatch =
  makeBatchDeleteMutation("irtCalibrationRuns");
export const deleteTryoutsBatch = makeBatchDeleteMutation("tryouts");
export const deleteExerciseQuestionsBatch =
  makeBatchDeleteMutation("exerciseQuestions");
export const deleteExerciseSetsBatch = makeBatchDeleteMutation("exerciseSets");
export const deleteSubjectSectionsBatch =
  makeBatchDeleteMutation("subjectSections");
export const deleteSubjectTopicsBatch =
  makeBatchDeleteMutation("subjectTopics");
export const deleteArticlesBatch = makeBatchDeleteMutation("articleContents");
export const deleteAuthorsBatch = makeBatchDeleteMutation("authors");
