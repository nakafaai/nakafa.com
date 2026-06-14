import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { assertContentSyncBatchSize } from "@repo/backend/convex/contentSync/lib/errors";
import {
  buildAuthorCache,
  deleteContentProjectionsByRoute,
  deleteExerciseQuestion,
  replaceExerciseChoices,
  syncContentAuthorsWithCache,
} from "@repo/backend/convex/contentSync/lib/syncHelpers";
import { hasSameSyncValues } from "@repo/backend/convex/contentSync/lib/syncValues";
import { getContentGraphIdentity } from "@repo/backend/convex/contents/graph";
import { syncContentRoute } from "@repo/backend/convex/contents/helpers/routes/write";
import { syncContentSearch } from "@repo/backend/convex/contents/helpers/search/write";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  exercisesCategoryValidator,
  exercisesMaterialValidator,
  exercisesTypeValidator,
  localeValidator,
} from "@repo/backend/convex/lib/validators/contents";
import { logger } from "@repo/backend/convex/utils/logger";
import { getExerciseSetGroupRoute } from "@repo/contents/_types/graph/projection";
import { ConvexError, v } from "convex/values";
import { getAll } from "convex-helpers/server/relationships";

const syncedExerciseSetValidator = v.object({
  category: exercisesCategoryValidator,
  contentHash: v.string(),
  description: v.optional(v.string()),
  exerciseType: v.string(),
  exerciseTypeTitle: v.string(),
  groupContentHash: v.string(),
  locale: localeValidator,
  material: exercisesMaterialValidator,
  questionCount: v.number(),
  searchDescription: v.string(),
  searchText: v.string(),
  searchTitle: v.string(),
  setName: v.string(),
  slug: v.string(),
  title: v.string(),
  type: exercisesTypeValidator,
  year: v.optional(v.string()),
});

const syncedExerciseChoiceValidator = v.object({
  isCorrect: v.boolean(),
  label: v.string(),
  optionKey: v.string(),
  order: v.number(),
});

const syncedExerciseChoicesValidator = v.object({
  en: v.array(syncedExerciseChoiceValidator),
  id: v.array(syncedExerciseChoiceValidator),
});

const syncedExerciseQuestionValidator = v.object({
  answerBody: v.string(),
  authors: v.array(v.object({ name: v.string() })),
  category: exercisesCategoryValidator,
  choices: syncedExerciseChoicesValidator,
  contentHash: v.string(),
  date: v.number(),
  description: v.optional(v.string()),
  exerciseType: v.string(),
  locale: localeValidator,
  material: exercisesMaterialValidator,
  number: v.number(),
  questionBody: v.string(),
  searchDescription: v.string(),
  searchText: v.string(),
  searchTitle: v.string(),
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

/** Requires the graph projection selector for an exercise set's group route. */
function requireExerciseSetGroupRoute(setSlug: string) {
  const route = getExerciseSetGroupRoute(setSlug);

  if (route) {
    return route;
  }

  throw new ConvexError({
    code: "CONTENT_SYNC_INVALID_EXERCISE_SET_ROUTE",
    message: "Exercise set route cannot be projected into a graph group route.",
    route: setSlug,
  });
}

/** Deletes an exercise group route when no published set remains in the group. */
async function deleteExerciseGroupRouteIfEmpty(
  ctx: MutationCtx,
  source: {
    category: Doc<"exerciseSets">["category"];
    exerciseType: string;
    locale: Doc<"exerciseSets">["locale"];
    material: Doc<"exerciseSets">["material"];
    slug: string;
    type: Doc<"exerciseSets">["type"];
    year?: string;
  }
) {
  const route = requireExerciseSetGroupRoute(source.slug);
  const sets = await ctx.db
    .query("exerciseSets")
    .withIndex("by_locale_and_group", (q) =>
      q
        .eq("locale", source.locale)
        .eq("category", source.category)
        .eq("type", source.type)
        .eq("material", source.material)
        .eq("exerciseType", source.exerciseType)
        .eq("year", source.year)
    )
    .take(CONTENT_SYNC_BATCH_LIMITS.exerciseSets + 1);
  const hasPublishedSet = sets.some((set) => set.questionCount > 0);

  if (hasPublishedSet) {
    return;
  }

  await deleteContentProjectionsByRoute(ctx, {
    locale: source.locale,
    route,
  });
}

/** Upsert exercise sets from the filesystem sync source. */
export const bulkSyncExerciseSets = internalMutation({
  args: {
    sets: v.array(syncedExerciseSetValidator),
  },
  returns: syncSummaryValidator,
  /** Applies one bounded exercise set sync batch and keeps set search rows current. */
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
      const groupRoute = requireExerciseSetGroupRoute(set.slug);
      const setGraph = getContentGraphIdentity({
        kind: "exercise-set",
        locale: set.locale,
        route: set.slug,
      });
      const groupGraph = getContentGraphIdentity({
        kind: "exercise-group",
        locale: set.locale,
        route: groupRoute,
      });
      if (set.questionCount > 0) {
        await syncContentSearch(ctx, {
          ...setGraph,
          contentHash: set.contentHash,
          description: set.searchDescription,
          locale: set.locale,
          route: set.slug,
          section: "exercises",
          syncedAt: now,
          text: set.searchText,
          title: set.searchTitle,
        });
        await syncContentRoute(ctx, {
          ...setGraph,
          contentHash: set.contentHash,
          description: set.description,
          kind: "exercise-set",
          locale: set.locale,
          markdown: true,
          route: set.slug,
          section: "exercises",
          syncedAt: now,
          title: set.title,
        });
        await syncContentRoute(ctx, {
          ...groupGraph,
          contentHash: set.groupContentHash,
          description: set.description,
          kind: "exercise-group",
          locale: set.locale,
          markdown: false,
          route: groupRoute,
          section: "exercises",
          syncedAt: now,
          title: set.exerciseTypeTitle,
        });
      } else {
        await deleteContentProjectionsByRoute(ctx, {
          locale: set.locale,
          route: set.slug,
        });
      }

      const nextValues = {
        category: set.category,
        description: set.description,
        exerciseType: set.exerciseType,
        material: set.material,
        questionCount: set.questionCount,
        setName: set.setName,
        title: set.title,
        type: set.type,
        year: set.year,
      };

      const existingSet = await ctx.db
        .query("exerciseSets")
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", set.locale).eq("slug", set.slug)
        )
        .unique();

      if (hasSameSyncValues(nextValues, existingSet)) {
        if (set.questionCount === 0) {
          await deleteExerciseGroupRouteIfEmpty(ctx, set);
        }
        unchanged++;
        continue;
      }

      if (existingSet) {
        await ctx.db.patch("exerciseSets", existingSet._id, {
          ...nextValues,
          syncedAt: now,
        });
        if (set.questionCount === 0) {
          await deleteExerciseGroupRouteIfEmpty(ctx, set);
        }
        updated++;
        continue;
      }

      await ctx.db.insert("exerciseSets", {
        ...nextValues,
        locale: set.locale,
        slug: set.slug,
        syncedAt: now,
      });
      if (set.questionCount === 0) {
        await deleteExerciseGroupRouteIfEmpty(ctx, set);
      }
      created++;
    }

    return { created, unchanged, updated };
  },
});

/** Upsert exercise questions, choices, and author links from the filesystem sync source. */
export const bulkSyncExerciseQuestions = internalMutation({
  args: {
    questions: v.array(syncedExerciseQuestionValidator),
  },
  returns: syncQuestionsResultValidator,
  /** Applies one bounded exercise question sync batch to runtime, search, author, and choice rows. */
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
      const graph = getContentGraphIdentity({
        kind: "exercise-question",
        locale: question.locale,
        route: question.slug,
      });
      const exerciseSet = await ctx.db
        .query("exerciseSets")
        .withIndex("by_locale_and_slug", (q) =>
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
        .withIndex("by_locale_and_slug", (q) =>
          q.eq("locale", question.locale).eq("slug", question.slug)
        )
        .unique();

      await syncContentSearch(ctx, {
        ...graph,
        contentHash: question.contentHash,
        description: question.searchDescription,
        locale: question.locale,
        route: question.slug,
        section: "exercises",
        syncedAt: now,
        text: question.searchText,
        title: question.searchTitle,
      });
      await syncContentRoute(ctx, {
        ...graph,
        authors: question.authors,
        contentHash: question.contentHash,
        date: question.date,
        description: question.searchDescription,
        kind: "exercise-question",
        locale: question.locale,
        markdown: true,
        route: question.slug,
        section: "exercises",
        syncedAt: now,
        title: question.searchTitle,
      });

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

      if (hasSameSyncValues(nextValues, existingQuestion)) {
        unchanged++;
        continue;
      }

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

/** Delete stale exercise sets after their questions have been removed. */
export const deleteStaleExerciseSets = internalMutation({
  args: {
    setIds: v.array(v.id("exerciseSets")),
  },
  returns: deleteResultValidator,
  /** Removes one bounded stale exercise set batch after validating question counts. */
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
      const questions = await ctx.db
        .query("exerciseQuestions")
        .withIndex("by_setId", (q) => q.eq("setId", setId))
        .take(exerciseSet.questionCount + 1);

      if (questions.length > exerciseSet.questionCount) {
        throw new ConvexError({
          code: "CONTENT_SYNC_QUESTION_COUNT_EXCEEDED",
          message: "Exercise question count exceeds the set question count.",
        });
      }

      for (const question of questions) {
        await deleteExerciseQuestion(ctx, question._id);
      }

      await deleteContentProjectionsByRoute(ctx, {
        locale: exerciseSet.locale,
        route: exerciseSet.slug,
      });

      await ctx.db.delete("exerciseSets", setId);
      await deleteExerciseGroupRouteIfEmpty(ctx, exerciseSet);
      deleted++;
    }

    return { deleted };
  },
});

/** Delete stale exercise questions together with sync-managed dependent rows. */
export const deleteStaleExerciseQuestions = internalMutation({
  args: {
    questionIds: v.array(v.id("exerciseQuestions")),
  },
  returns: deleteResultValidator,
  /** Removes one bounded stale exercise question batch and its sync-owned dependent rows. */
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
