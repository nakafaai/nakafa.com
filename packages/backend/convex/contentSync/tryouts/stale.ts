import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import { deleteQuestion } from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { ConvexError } from "convex/values";

/** Deletes one bounded stale question batch with sync-owned choice rows. */
export async function deleteStaleQuestionsImpl(
  ctx: MutationCtx,
  args: { questionIds: Id<"questions">[] }
) {
  assertContentSyncBatchSize({
    functionName: "deleteStaleQuestions",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleQuestions,
    received: args.questionIds.length,
    unit: "questions",
  });

  for (const questionId of args.questionIds) {
    await deleteQuestion(ctx, questionId);
  }

  return { deleted: args.questionIds.length };
}

/** Deletes one bounded stale question-set batch after its sections are removed. */
export async function deleteStaleQuestionSetsImpl(
  ctx: MutationCtx,
  args: { questionSetIds: Id<"questionSets">[] }
) {
  assertContentSyncBatchSize({
    functionName: "deleteStaleQuestionSets",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleQuestionSets,
    received: args.questionSetIds.length,
    unit: "question sets",
  });

  let deleted = 0;
  for (const questionSetId of args.questionSetIds) {
    await deleteQuestionSet(ctx, questionSetId);
    deleted++;
  }

  return { deleted };
}

/** Deletes one bounded stale try-out section batch. */
export async function deleteStaleTryoutSectionsImpl(
  ctx: MutationCtx,
  args: { sectionIds: Id<"tryoutSections">[] }
) {
  assertContentSyncBatchSize({
    functionName: "deleteStaleTryoutSections",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleTryoutSections,
    received: args.sectionIds.length,
    unit: "try-out sections",
  });

  for (const sectionId of args.sectionIds) {
    await ctx.db.delete("tryoutSections", sectionId);
  }

  return { deleted: args.sectionIds.length };
}

/** Deletes one bounded stale try-out set batch with direct section rows. */
export async function deleteStaleTryoutSetsImpl(
  ctx: MutationCtx,
  args: { setIds: Id<"tryoutSets">[] }
) {
  assertContentSyncBatchSize({
    functionName: "deleteStaleTryoutSets",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleTryoutSets,
    received: args.setIds.length,
    unit: "try-out sets",
  });

  let deleted = 0;
  for (const setId of args.setIds) {
    await deleteTryoutSet(ctx, setId);
    deleted++;
  }

  return { deleted };
}

/** Deletes one bounded stale try-out exam batch. */
export async function deleteStaleTryoutExamsImpl(
  ctx: MutationCtx,
  args: { examIds: Id<"tryoutExams">[] }
) {
  assertContentSyncBatchSize({
    functionName: "deleteStaleTryoutExams",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleTryoutExams,
    received: args.examIds.length,
    unit: "try-out exams",
  });

  for (const examId of args.examIds) {
    await ctx.db.delete("tryoutExams", examId);
  }

  return { deleted: args.examIds.length };
}

/** Deletes one bounded stale try-out country batch. */
export async function deleteStaleTryoutCountriesImpl(
  ctx: MutationCtx,
  args: { countryIds: Id<"tryoutCountries">[] }
) {
  assertContentSyncBatchSize({
    functionName: "deleteStaleTryoutCountries",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleTryoutCountries,
    received: args.countryIds.length,
    unit: "try-out countries",
  });

  for (const countryId of args.countryIds) {
    await ctx.db.delete("tryoutCountries", countryId);
  }

  return { deleted: args.countryIds.length };
}

async function deleteQuestionSet(
  ctx: MutationCtx,
  questionSetId: Id<"questionSets">
) {
  const questions = await ctx.db
    .query("questions")
    .withIndex("by_questionSetId_and_number", (q) =>
      q.eq("questionSetId", questionSetId)
    )
    .take(1);

  if (questions.length > 0) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_QUESTION_SET_NOT_EMPTY",
      message: "Delete stale questions before deleting their question set.",
    });
  }

  const sections = await ctx.db
    .query("tryoutSections")
    .withIndex("by_questionSetId", (q) => q.eq("questionSetId", questionSetId))
    .take(CONTENT_SYNC_BATCH_LIMITS.tryoutSets + 1);

  if (sections.length > CONTENT_SYNC_BATCH_LIMITS.tryoutSets) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_SECTION_DELETE_LIMIT_EXCEEDED",
      message: "Question set has too many try-out sections to delete safely.",
    });
  }

  for (const section of sections) {
    await ctx.db.delete(section._id);
  }
  await ctx.db.delete("questionSets", questionSetId);
}

async function deleteTryoutSet(ctx: MutationCtx, setId: Id<"tryoutSets">) {
  const sections = await ctx.db
    .query("tryoutSections")
    .withIndex("by_tryoutSetId_and_order", (q) => q.eq("tryoutSetId", setId))
    .take(CONTENT_SYNC_BATCH_LIMITS.staleTryoutSections + 1);

  if (sections.length > CONTENT_SYNC_BATCH_LIMITS.staleTryoutSections) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_SECTION_DELETE_LIMIT_EXCEEDED",
      message: "Try-out set has too many sections to delete safely.",
    });
  }

  for (const section of sections) {
    await ctx.db.delete(section._id);
  }
  await ctx.db.delete("tryoutSets", setId);
}
