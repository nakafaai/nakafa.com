import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { deleteQuestion } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import {
  deleteQuestionSet,
  deleteTryoutCountry,
  deleteTryoutExam,
  deleteTryoutSection,
  deleteTryoutSet,
  deleteTryoutTrack,
} from "@repo/backend/convex/contentSync/tryouts/delete";
import { validateTryoutBatch } from "@repo/backend/convex/contentSync/tryouts/error";
import { Effect } from "effect";

/** Deletes one bounded stale question batch with sync-owned choice rows. */
export const deleteStaleQuestions = Effect.fn(
  "contentSync.tryout.deleteStaleQuestions"
)(function* (ctx: MutationCtx, args: { questionIds: Id<"questions">[] }) {
  yield* validateTryoutBatch({
    functionName: "deleteStaleQuestions",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleQuestions,
    received: args.questionIds.length,
    unit: "questions",
  });

  for (const questionId of args.questionIds) {
    yield* Effect.promise(() => deleteQuestion(ctx, questionId));
  }

  return { deleted: args.questionIds.length };
});

/** Deletes one bounded stale question-set batch after its sections are removed. */
export const deleteStaleQuestionSets = Effect.fn(
  "contentSync.tryout.deleteStaleQuestionSets"
)(function* (ctx: MutationCtx, args: { questionSetIds: Id<"questionSets">[] }) {
  yield* validateTryoutBatch({
    functionName: "deleteStaleQuestionSets",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleQuestionSets,
    received: args.questionSetIds.length,
    unit: "question sets",
  });

  for (const questionSetId of args.questionSetIds) {
    yield* deleteQuestionSet(ctx, questionSetId);
  }

  return { deleted: args.questionSetIds.length };
});

/** Deletes one bounded stale try-out section batch. */
export const deleteStaleTryoutSections = Effect.fn(
  "contentSync.tryout.deleteStaleSections"
)(function* (ctx: MutationCtx, args: { sectionIds: Id<"tryoutSections">[] }) {
  yield* validateTryoutBatch({
    functionName: "deleteStaleTryoutSections",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleTryoutSections,
    received: args.sectionIds.length,
    unit: "try-out sections",
  });

  let deleted = 0;
  for (const sectionId of args.sectionIds) {
    deleted += yield* deleteTryoutSection(ctx, sectionId);
  }

  return { deleted };
});

/** Deletes one bounded stale try-out set batch with direct section rows. */
export const deleteStaleTryoutSets = Effect.fn(
  "contentSync.tryout.deleteStaleSets"
)(function* (ctx: MutationCtx, args: { setIds: Id<"tryoutSets">[] }) {
  yield* validateTryoutBatch({
    functionName: "deleteStaleTryoutSets",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleTryoutSets,
    received: args.setIds.length,
    unit: "try-out sets",
  });

  let deleted = 0;
  for (const setId of args.setIds) {
    deleted += yield* deleteTryoutSet(ctx, setId);
  }

  return { deleted };
});

/** Deletes one bounded stale try-out track batch after its sets are removed. */
export const deleteStaleTryoutTracks = Effect.fn(
  "contentSync.tryout.deleteStaleTracks"
)(function* (ctx: MutationCtx, args: { trackIds: Id<"tryoutTracks">[] }) {
  yield* validateTryoutBatch({
    functionName: "deleteStaleTryoutTracks",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleTryoutTracks,
    received: args.trackIds.length,
    unit: "try-out tracks",
  });

  let deleted = 0;
  for (const trackId of args.trackIds) {
    deleted += yield* deleteTryoutTrack(ctx, trackId);
  }

  return { deleted };
});

/** Deletes one bounded stale try-out exam batch. */
export const deleteStaleTryoutExams = Effect.fn(
  "contentSync.tryout.deleteStaleExams"
)(function* (ctx: MutationCtx, args: { examIds: Id<"tryoutExams">[] }) {
  yield* validateTryoutBatch({
    functionName: "deleteStaleTryoutExams",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleTryoutExams,
    received: args.examIds.length,
    unit: "try-out exams",
  });

  let deleted = 0;
  for (const examId of args.examIds) {
    deleted += yield* deleteTryoutExam(ctx, examId);
  }

  return { deleted };
});

/** Deletes one bounded stale try-out country batch. */
export const deleteStaleTryoutCountries = Effect.fn(
  "contentSync.tryout.deleteStaleCountries"
)(function* (ctx: MutationCtx, args: { countryIds: Id<"tryoutCountries">[] }) {
  yield* validateTryoutBatch({
    functionName: "deleteStaleTryoutCountries",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleTryoutCountries,
    received: args.countryIds.length,
    unit: "try-out countries",
  });

  let deleted = 0;
  for (const countryId of args.countryIds) {
    deleted += yield* deleteTryoutCountry(ctx, countryId);
  }

  return { deleted };
});
