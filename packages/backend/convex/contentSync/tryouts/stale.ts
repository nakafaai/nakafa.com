import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  deleteContentProjectionsBySourcePath,
  deleteQuestion,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
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

  let deleted = 0;
  for (const sectionId of args.sectionIds) {
    deleted += await deleteTryoutSection(ctx, sectionId);
  }

  return { deleted };
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
    deleted += await deleteTryoutSet(ctx, setId);
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

  let deleted = 0;
  for (const examId of args.examIds) {
    deleted += await deleteTryoutExam(ctx, examId);
  }

  return { deleted };
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

  let deleted = 0;
  for (const countryId of args.countryIds) {
    deleted += await deleteTryoutCountry(ctx, countryId);
  }

  return { deleted };
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

  if (sections.length > 0) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_QUESTION_SET_HAS_SECTIONS",
      message: "Delete stale try-out sections before their question set.",
    });
  }

  await ctx.db.delete("questionSets", questionSetId);
}

async function deleteTryoutSection(
  ctx: MutationCtx,
  sectionId: Id<"tryoutSections">
) {
  const section = await ctx.db.get(sectionId);

  if (!section) {
    return 0;
  }

  await deleteContentProjectionsBySourcePath(ctx, {
    locale: section.locale,
    route: section.publicPath,
  });
  await ctx.db.delete("tryoutSections", sectionId);
  return 1;
}

async function deleteTryoutSet(ctx: MutationCtx, setId: Id<"tryoutSets">) {
  const set = await ctx.db.get(setId);

  if (!set) {
    return 0;
  }

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

  if (sections.length > 0) {
    throw new ConvexError({
      code: "TRYOUT_SYNC_SET_HAS_SECTIONS",
      message: "Delete stale try-out sections before their set.",
    });
  }

  await deleteContentProjectionsBySourcePath(ctx, {
    locale: set.locale,
    route: set.publicPath,
  });
  await ctx.db.delete("tryoutSets", setId);
  return 1;
}

async function deleteTryoutExam(ctx: MutationCtx, examId: Id<"tryoutExams">) {
  const exam = await ctx.db.get(examId);

  if (!exam) {
    return 0;
  }

  await deleteContentProjectionsBySourcePath(ctx, {
    locale: exam.locale,
    route: exam.publicPath,
  });
  await ctx.db.delete("tryoutExams", examId);
  return 1;
}

async function deleteTryoutCountry(
  ctx: MutationCtx,
  countryId: Id<"tryoutCountries">
) {
  const country = await ctx.db.get(countryId);

  if (!country) {
    return 0;
  }

  await deleteContentProjectionsBySourcePath(ctx, {
    locale: country.locale,
    route: country.publicPath,
  });
  await ctx.db.delete("tryoutCountries", countryId);
  return 1;
}
