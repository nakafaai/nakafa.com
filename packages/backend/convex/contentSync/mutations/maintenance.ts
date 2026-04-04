import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import { ConvexError, v } from "convex/values";

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
  | "irtScaleQualityRefreshQueue"
  | "irtScalePublicationQueue"
  | "irtScaleVersionItems"
  | "irtScaleVersions"
  | "subjectSections"
  | "subjectTopics"
  | "tryoutAttempts"
  | "tryoutCatalogEntries"
  | "tryoutCatalogMeta"
  | "tryoutLeaderboardEntries"
  | "tryoutPartAttempts"
  | "tryoutPartSets"
  | "tryouts"
  | "userTryoutCatalogStatuses"
  | "userTryoutLatestAttempts"
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

/**
 * Delete one bounded batch of tryout part attempts together with their linked
 * tryout-owned exercise attempts and exercise answers.
 *
 * This is intentionally narrower than the full content reset path so operators
 * can wipe tryout runtime data without touching standalone exercise history.
 */
export const deleteTryoutRuntimeBatch = internalMutation({
  args: {},
  returns: batchDeleteResultValidator,
  handler: async (ctx) => {
    const partAttempts = await ctx.db
      .query("tryoutPartAttempts")
      .take(RESET_BATCH_SIZE);
    let deleted = 0;

    for (const partAttempt of partAttempts) {
      const exerciseAttempt = await ctx.db.get(
        "exerciseAttempts",
        partAttempt.setAttemptId
      );

      if (exerciseAttempt) {
        const answers = await ctx.db
          .query("exerciseAnswers")
          .withIndex("by_attemptId_and_exerciseNumber", (q) =>
            q.eq("attemptId", exerciseAttempt._id)
          )
          .take(exerciseAttempt.totalExercises + 1);

        if (answers.length > exerciseAttempt.totalExercises) {
          throw new ConvexError({
            code: "TRYOUT_EXERCISE_ANSWER_COUNT_EXCEEDED",
            message:
              "Tryout exercise answer count exceeds the exercise attempt total exercises.",
          });
        }

        for (const answer of answers) {
          await ctx.db.delete("exerciseAnswers", answer._id);
        }

        await ctx.db.delete("exerciseAttempts", exerciseAttempt._id);
      }

      await ctx.db.delete("tryoutPartAttempts", partAttempt._id);
      deleted += 1;
    }

    const hasMore = (await ctx.db.query("tryoutPartAttempts").first()) !== null;

    return { deleted, hasMore };
  },
});

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
export const deleteUserTryoutLatestAttemptsBatch = makeBatchDeleteMutation(
  "userTryoutLatestAttempts"
);
export const deleteUserTryoutCatalogStatusesBatch = makeBatchDeleteMutation(
  "userTryoutCatalogStatuses"
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
export const deleteIrtScaleQualityRefreshQueueBatch = makeBatchDeleteMutation(
  "irtScaleQualityRefreshQueue"
);
export const deleteExerciseAttemptsBatch =
  makeBatchDeleteMutation("exerciseAttempts");
export const deleteTryoutAttemptsBatch =
  makeBatchDeleteMutation("tryoutAttempts");
export const deleteTryoutCatalogEntriesBatch = makeBatchDeleteMutation(
  "tryoutCatalogEntries"
);
export const deleteTryoutCatalogMetaBatch =
  makeBatchDeleteMutation("tryoutCatalogMeta");
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
