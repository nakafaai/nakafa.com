import {
  bulkSyncTryoutsImpl,
  deleteStaleQuestionSetsImpl,
  deleteStaleQuestionsImpl,
} from "@repo/backend/convex/contentSync/tryouts/impl";
import {
  bulkSyncTryoutsResultValidator,
  deleteResultValidator,
  syncedQuestionSetValidator,
  syncedQuestionValidator,
  syncedTryoutCountryValidator,
  syncedTryoutExamValidator,
  syncedTryoutSectionValidator,
  syncedTryoutSetValidator,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

/** Upserts one bounded try-out catalog and question-bank batch. */
export const bulkSyncTryouts = internalMutation({
  args: {
    countries: v.array(syncedTryoutCountryValidator),
    exams: v.array(syncedTryoutExamValidator),
    sets: v.array(syncedTryoutSetValidator),
    questionSets: v.array(syncedQuestionSetValidator),
    questions: v.array(syncedQuestionValidator),
    sections: v.array(syncedTryoutSectionValidator),
  },
  returns: bulkSyncTryoutsResultValidator,
  handler: async (ctx, args) => await bulkSyncTryoutsImpl(ctx, args),
});

/** Deletes one bounded stale question batch with sync-owned choice rows. */
export const deleteStaleQuestions = internalMutation({
  args: {
    questionIds: v.array(v.id("questions")),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => await deleteStaleQuestionsImpl(ctx, args),
});

/** Deletes one bounded stale question-set batch after its sections are removed. */
export const deleteStaleQuestionSets = internalMutation({
  args: {
    questionSetIds: v.array(v.id("questionSets")),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => await deleteStaleQuestionSetsImpl(ctx, args),
});
