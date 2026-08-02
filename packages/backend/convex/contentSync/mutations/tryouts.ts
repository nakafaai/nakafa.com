import { syncTryouts } from "@repo/backend/convex/contentSync/tryouts/impl";
import { requireFilesystemOwner } from "@repo/backend/convex/contentSync/tryouts/source";
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
  syncedTryoutTrackValidator,
} from "@repo/backend/convex/contentSync/tryouts/spec";
import {
  deleteStaleTryoutCountries as deleteCountries,
  deleteStaleTryoutExams as deleteExams,
  deleteStaleQuestionSets as deleteQuestionSets,
  deleteStaleQuestions as deleteQuestions,
  deleteStaleTryoutSections as deleteSections,
  deleteStaleTryoutSets as deleteSets,
  deleteStaleTryoutTracks as deleteTracks,
} from "@repo/backend/convex/contentSync/tryouts/stale";
import { internalMutation } from "@repo/backend/convex/functions";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

/** Upserts one bounded try-out catalog and question-bank batch. */
export const bulkSyncTryouts = internalMutation({
  args: {
    countries: v.array(syncedTryoutCountryValidator),
    exams: v.array(syncedTryoutExamValidator),
    routes: v.array(syncedTryoutRouteValidator),
    sets: v.array(syncedTryoutSetValidator),
    tracks: v.array(syncedTryoutTrackValidator),
    questionSets: v.array(syncedQuestionSetValidator),
    questions: v.array(syncedQuestionValidator),
    sections: v.array(syncedTryoutSectionValidator),
  },
  returns: bulkSyncTryoutsResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      requireFilesystemOwner(ctx).pipe(Effect.andThen(syncTryouts(ctx, args)))
    ),
});

/** Deletes one bounded stale question batch with sync-owned choice rows. */
export const deleteStaleQuestions = internalMutation({
  args: {
    questionIds: v.array(v.id("questions")),
  },
  returns: deleteResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      requireFilesystemOwner(ctx).pipe(
        Effect.andThen(deleteQuestions(ctx, args))
      )
    ),
});

/** Deletes one bounded stale question-set batch after its sections are removed. */
export const deleteStaleQuestionSets = internalMutation({
  args: {
    questionSetIds: v.array(v.id("questionSets")),
  },
  returns: deleteResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      requireFilesystemOwner(ctx).pipe(
        Effect.andThen(deleteQuestionSets(ctx, args))
      )
    ),
});

/** Deletes one bounded stale try-out section batch. */
export const deleteStaleTryoutSections = internalMutation({
  args: {
    sectionIds: v.array(v.id("tryoutSections")),
  },
  returns: deleteResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      requireFilesystemOwner(ctx).pipe(
        Effect.andThen(deleteSections(ctx, args))
      )
    ),
});

/** Deletes one bounded stale try-out set batch with direct section rows. */
export const deleteStaleTryoutSets = internalMutation({
  args: {
    setIds: v.array(v.id("tryoutSets")),
  },
  returns: deleteResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      requireFilesystemOwner(ctx).pipe(Effect.andThen(deleteSets(ctx, args)))
    ),
});

/** Deletes one bounded stale try-out track batch after direct set rows. */
export const deleteStaleTryoutTracks = internalMutation({
  args: {
    trackIds: v.array(v.id("tryoutTracks")),
  },
  returns: deleteResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      requireFilesystemOwner(ctx).pipe(Effect.andThen(deleteTracks(ctx, args)))
    ),
});

/** Deletes one bounded stale try-out exam batch. */
export const deleteStaleTryoutExams = internalMutation({
  args: {
    examIds: v.array(v.id("tryoutExams")),
  },
  returns: deleteResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      requireFilesystemOwner(ctx).pipe(Effect.andThen(deleteExams(ctx, args)))
    ),
});

/** Deletes one bounded stale try-out country batch. */
export const deleteStaleTryoutCountries = internalMutation({
  args: {
    countryIds: v.array(v.id("tryoutCountries")),
  },
  returns: deleteResultValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      requireFilesystemOwner(ctx).pipe(
        Effect.andThen(deleteCountries(ctx, args))
      )
    ),
});
