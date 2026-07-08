import { bulkSyncTryoutsImpl } from "@repo/backend/convex/contentSync/tryouts/impl";
import {
  bulkSyncTryoutsResultValidator,
  deleteResultValidator,
  syncedQuestionSetValidator,
  syncedQuestionValidator,
  syncedTryoutCountryValidator,
  syncedTryoutExamValidator,
  syncedTryoutRouteValidator,
  syncedTryoutSectionValidator,
  syncedTryoutSetValidator,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import {
  deleteStaleQuestionSetsImpl,
  deleteStaleQuestionsImpl,
  deleteStaleTryoutCountriesImpl,
  deleteStaleTryoutExamsImpl,
  deleteStaleTryoutSectionsImpl,
  deleteStaleTryoutSetsImpl,
} from "@repo/backend/convex/contentSync/tryouts/stale";
import { internalMutation } from "@repo/backend/convex/functions";
import { v } from "convex/values";

/** Upserts one bounded try-out catalog and question-bank batch. */
export const bulkSyncTryouts = internalMutation({
  args: {
    countries: v.array(syncedTryoutCountryValidator),
    exams: v.array(syncedTryoutExamValidator),
    routes: v.array(syncedTryoutRouteValidator),
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

/** Deletes one bounded stale try-out section batch. */
export const deleteStaleTryoutSections = internalMutation({
  args: {
    sectionIds: v.array(v.id("tryoutSections")),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => await deleteStaleTryoutSectionsImpl(ctx, args),
});

/** Deletes one bounded stale try-out set batch with direct section rows. */
export const deleteStaleTryoutSets = internalMutation({
  args: {
    setIds: v.array(v.id("tryoutSets")),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => await deleteStaleTryoutSetsImpl(ctx, args),
});

/** Deletes one bounded stale try-out exam batch. */
export const deleteStaleTryoutExams = internalMutation({
  args: {
    examIds: v.array(v.id("tryoutExams")),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => await deleteStaleTryoutExamsImpl(ctx, args),
});

/** Deletes one bounded stale try-out country batch. */
export const deleteStaleTryoutCountries = internalMutation({
  args: {
    countryIds: v.array(v.id("tryoutCountries")),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => await deleteStaleTryoutCountriesImpl(ctx, args),
});
