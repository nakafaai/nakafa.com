import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  buildAuthorCache,
  deleteContentAuthorLinks,
  deleteExerciseChoicesForQuestion,
  replaceExerciseChoices,
  syncContentAuthorsWithCache,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  exercisesCategoryValidator,
  exercisesMaterialValidator,
  exercisesTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { logger } from "@repo/backend/convex/utils/logger";
import { v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const syncedExerciseSetValidator = v.object({
  category: exercisesCategoryValidator,
  description: v.optional(v.string()),
  exerciseType: v.string(),
  locale: localeValidator,
  material: exercisesMaterialValidator,
  questionCount: v.number(),
  setName: v.string(),
  slug: v.string(),
  title: v.string(),
  type: exercisesTypeValidator,
});

const syncedExerciseChoiceValidator = v.object({
  isCorrect: v.boolean(),
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
});

const syncedExerciseQuestionValidator = v.object({
  answerBody: v.string(),
  authors: v.array(v.object({ name: v.string() })),
  category: exercisesCategoryValidator,
  choices: v.array(syncedExerciseChoiceValidator),
  contentHash: v.string(),
  date: v.number(),
  description: v.optional(v.string()),
  exerciseType: v.string(),
  locale: localeValidator,
  material: exercisesMaterialValidator,
  number: v.number(),
  questionBody: v.string(),
  setName: v.string(),
  setSlug: v.string(),
  slug: v.string(),
  title: v.string(),
  type: exercisesTypeValidator,
});

const syncSummaryValidator = v.object({
  created: v.number(),
  unchanged: v.number(),
  updated: v.number(),
});

const syncQuestionsResultValidator = v.object({
  authorLinksCreated: v.number(),
  choicesCreated: v.number(),
  created: v.number(),
  skipped: v.number(),
  skippedSetSlugs: v.array(v.string()),
  unchanged: v.number(),
  updated: v.number(),
});

const deleteResultValidator = v.object({
  deleted: v.number(),
});

async function deleteExerciseQuestion(
  ctx: MutationCtx,
  questionId: Id<"exerciseQuestions">
) {
  await deleteContentAuthorLinks(ctx, questionId, "exercise");
  await deleteExerciseChoicesForQuestion(ctx, questionId);
  await ctx.db.delete("exerciseQuestions", questionId);
}

export const bulkSyncExerciseSets = internalMutation({
  args: {
    sets: v.array(syncedExerciseSetValidator),
  },
  returns: syncSummaryValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncExerciseSets",
      limit: CONTENT_SYNC_BATCH_LIMITS.exerciseSets,
      received: args.sets.length,
      unit: "exercise sets",
    });

    const now = Date.now();
    let created = 0;
    let unchanged = 0;
    let updated = 0;

    for (const set of args.sets) {
      const nextValues = {
        category: set.category,
        description: set.description,
        exerciseType: set.exerciseType,
        material: set.material,
        questionCount: set.questionCount,
        setName: set.setName,
        title: set.title,
        type: set.type,
      };

      const existingSet = await ctx.db
        .query("exerciseSets")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", set.locale).eq("slug", set.slug)
        )
        .unique();

      if (
        existingSet &&
        existingSet.category === nextValues.category &&
        existingSet.description === nextValues.description &&
        existingSet.exerciseType === nextValues.exerciseType &&
        existingSet.material === nextValues.material &&
        existingSet.questionCount === nextValues.questionCount &&
        existingSet.setName === nextValues.setName &&
        existingSet.title === nextValues.title &&
        existingSet.type === nextValues.type
      ) {
        unchanged++;
        continue;
      }

      if (existingSet) {
        await ctx.db.patch("exerciseSets", existingSet._id, {
          ...nextValues,
          syncedAt: now,
        });
        updated++;
        continue;
      }

      await ctx.db.insert("exerciseSets", {
        ...nextValues,
        locale: set.locale,
        slug: set.slug,
        syncedAt: now,
      });
      created++;
    }

    return { created, unchanged, updated };
  },
});

export const bulkSyncExerciseQuestions = internalMutation({
  args: {
    questions: v.array(syncedExerciseQuestionValidator),
  },
  returns: syncQuestionsResultValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "bulkSyncExerciseQuestions",
      limit: CONTENT_SYNC_BATCH_LIMITS.exerciseQuestions,
      received: args.questions.length,
      unit: "exercise questions",
    });

    const now = Date.now();
    let authorLinksCreated = 0;
    let choicesCreated = 0;
    let created = 0;
    let skipped = 0;
    let unchanged = 0;
    let updated = 0;
    const skippedSetSlugs = new Set<string>();

    const allAuthorNames = args.questions.flatMap((question) =>
      question.authors.map((author) => author.name)
    );
    const authorCache = await buildAuthorCache(ctx, allAuthorNames);

    for (const question of args.questions) {
      const exerciseSet = await ctx.db
        .query("exerciseSets")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", question.locale).eq("slug", question.setSlug)
        )
        .unique();

      if (!exerciseSet) {
        skipped++;
        skippedSetSlugs.add(question.setSlug);
        logger.warn(`Set not found for question: ${question.slug}`);
        continue;
      }

      const existingQuestion = await ctx.db
        .query("exerciseQuestions")
        .withIndex("locale_slug", (q) =>
          q.eq("locale", question.locale).eq("slug", question.slug)
        )
        .unique();

      if (existingQuestion?.contentHash === question.contentHash) {
        unchanged++;
        continue;
      }

      const nextValues = {
        answerBody: question.answerBody,
        category: question.category,
        contentHash: question.contentHash,
        date: question.date,
        description: question.description,
        exerciseType: question.exerciseType,
        material: question.material,
        number: question.number,
        questionBody: question.questionBody,
        setId: exerciseSet._id,
        setName: question.setName,
        title: question.title,
        type: question.type,
      };

      if (existingQuestion) {
        await ctx.db.patch("exerciseQuestions", existingQuestion._id, {
          ...nextValues,
          syncedAt: now,
        });

        authorLinksCreated += await syncContentAuthorsWithCache(
          ctx,
          existingQuestion._id,
          "exercise",
          question.authors,
          authorCache
        );
        choicesCreated += await replaceExerciseChoices(ctx, {
          choices: question.choices,
          locale: question.locale,
          questionId: existingQuestion._id,
        });

        updated++;
        continue;
      }

      const questionId = await ctx.db.insert("exerciseQuestions", {
        ...nextValues,
        locale: question.locale,
        slug: question.slug,
        syncedAt: now,
      });

      authorLinksCreated += await syncContentAuthorsWithCache(
        ctx,
        questionId,
        "exercise",
        question.authors,
        authorCache
      );
      choicesCreated += await replaceExerciseChoices(ctx, {
        choices: question.choices,
        locale: question.locale,
        questionId,
      });

      created++;
    }

    return {
      authorLinksCreated,
      choicesCreated,
      created,
      skipped,
      skippedSetSlugs: [...skippedSetSlugs],
      unchanged,
      updated,
    };
  },
});

export const deleteStaleExerciseSets = internalMutation({
  args: {
    setIds: v.array(v.id("exerciseSets")),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "deleteStaleExerciseSets",
      limit: CONTENT_SYNC_BATCH_LIMITS.staleExerciseSets,
      received: args.setIds.length,
      unit: "exercise set IDs",
    });

    if (args.setIds.length === 0) {
      return { deleted: 0 };
    }

    const sets = await getAll(ctx.db, args.setIds);
    let deleted = 0;

    for (const [index, exerciseSet] of sets.entries()) {
      if (!exerciseSet) {
        continue;
      }

      const setId = args.setIds[index];
      while (true) {
        const questions = await ctx.db
          .query("exerciseQuestions")
          .withIndex("setId", (q) => q.eq("setId", setId))
          .take(CONTENT_SYNC_BATCH_LIMITS.exerciseQuestions);

        if (questions.length === 0) {
          break;
        }

        for (const question of questions) {
          await deleteExerciseQuestion(ctx, question._id);
        }
      }

      await ctx.db.delete("exerciseSets", setId);
      deleted++;
    }

    return { deleted };
  },
});

export const deleteStaleExerciseQuestions = internalMutation({
  args: {
    questionIds: v.array(v.id("exerciseQuestions")),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    assertContentSyncBatchSize({
      functionName: "deleteStaleExerciseQuestions",
      limit: CONTENT_SYNC_BATCH_LIMITS.staleExerciseQuestions,
      received: args.questionIds.length,
      unit: "exercise question IDs",
    });

    if (args.questionIds.length === 0) {
      return { deleted: 0 };
    }

    const questions = await getAll(ctx.db, args.questionIds);
    let deleted = 0;

    for (const [index, question] of questions.entries()) {
      if (!question) {
        continue;
      }

      const questionId = args.questionIds[index];
      await deleteExerciseQuestion(ctx, questionId);
      deleted++;
    }

    return { deleted };
  },
});
