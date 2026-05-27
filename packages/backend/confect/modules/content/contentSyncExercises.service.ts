import type { Id } from "@repo/backend/confect/_generated/dataModel";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import type {
  ExercisesCategory,
  ExercisesMaterial,
  ExercisesType,
  Locale,
} from "@repo/backend/confect/modules/content/content.schemas";
import { buildContentSearchRef } from "@repo/backend/confect/modules/content/contentSearch/documents.service";
import {
  deleteContentSearch,
  syncContentSearch,
} from "@repo/backend/confect/modules/content/contentSearch/writes.service";
import {
  assertContentSyncBatchSize,
  CONTENT_SYNC_BATCH_LIMITS,
  ContentSyncError,
} from "@repo/backend/confect/modules/content/contentSync.shared";
import {
  buildAuthorCache,
  deleteExerciseQuestion,
  replaceExerciseChoices,
  syncContentAuthorsWithCache,
} from "@repo/backend/confect/modules/content/contentSyncHelpers.service";
import { Clock, Effect } from "effect";

interface SyncedExerciseSet {
  readonly category: ExercisesCategory;
  readonly contentHash: string;
  readonly description?: string;
  readonly exerciseType: string;
  readonly locale: Locale;
  readonly material: ExercisesMaterial;
  readonly questionCount: number;
  readonly searchDescription: string;
  readonly searchText: string;
  readonly searchTitle: string;
  readonly setName: string;
  readonly slug: string;
  readonly title: string;
  readonly type: ExercisesType;
}

interface SyncedExerciseChoice {
  readonly isCorrect: boolean;
  readonly label: string;
  readonly optionKey: string;
  readonly order: number;
}

interface SyncedExerciseQuestion {
  readonly answerBody: string;
  readonly authors: readonly { readonly name: string }[];
  readonly category: ExercisesCategory;
  readonly choices: readonly SyncedExerciseChoice[];
  readonly contentHash: string;
  readonly date: number;
  readonly description?: string;
  readonly exerciseType: string;
  readonly locale: Locale;
  readonly material: ExercisesMaterial;
  readonly number: number;
  readonly questionBody: string;
  readonly searchDescription: string;
  readonly searchText: string;
  readonly searchTitle: string;
  readonly setName: string;
  readonly setSlug: string;
  readonly slug: string;
  readonly title: string;
  readonly type: ExercisesType;
}

/** Upserts exercise set rows and their search documents. */
export const bulkSyncExerciseSets = Effect.fn(
  "contentSync.exercises.bulkSyncExerciseSets"
)(function* (args: { sets: SyncedExerciseSet[] }) {
  const ctx = yield* MutationCtx;
  yield* assertContentSyncBatchSize({
    functionName: "bulkSyncExerciseSets",
    limit: CONTENT_SYNC_BATCH_LIMITS.exerciseSets,
    received: args.sets.length,
    unit: "exercise sets",
  });

  const now = yield* Clock.currentTimeMillis;
  let created = 0;
  let unchanged = 0;
  let updated = 0;

  for (const set of args.sets) {
    const searchRef = buildContentSearchRef({
      locale: set.locale,
      route: set.slug,
      section: "exercises",
    });

    if (set.questionCount > 0) {
      yield* syncContentSearch({
        contentHash: set.contentHash,
        description: set.searchDescription,
        locale: set.locale,
        route: set.slug,
        section: "exercises",
        syncedAt: now,
        text: set.searchText,
        title: set.searchTitle,
      });
    } else {
      yield* deleteContentSearch(searchRef.content_id);
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
    };
    const existingSet = yield* Effect.promise(() =>
      ctx.db
        .query("exerciseSets")
        .withIndex("by_locale_and_slug", (query) =>
          query.eq("locale", set.locale).eq("slug", set.slug)
        )
        .unique()
    );

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
      unchanged += 1;
      continue;
    }

    if (existingSet) {
      yield* Effect.promise(() =>
        ctx.db.patch(existingSet._id, {
          ...nextValues,
          syncedAt: now,
        })
      );
      updated += 1;
      continue;
    }

    yield* Effect.promise(() =>
      ctx.db.insert("exerciseSets", {
        ...nextValues,
        locale: set.locale,
        slug: set.slug,
        syncedAt: now,
      })
    );
    created += 1;
  }

  return { created, unchanged, updated };
});

/** Upserts exercise questions and linked choices, authors, and search rows. */
export const bulkSyncExerciseQuestions = Effect.fn(
  "contentSync.exercises.bulkSyncExerciseQuestions"
)(function* (args: { questions: SyncedExerciseQuestion[] }) {
  const ctx = yield* MutationCtx;
  yield* assertContentSyncBatchSize({
    functionName: "bulkSyncExerciseQuestions",
    limit: CONTENT_SYNC_BATCH_LIMITS.exerciseQuestions,
    received: args.questions.length,
    unit: "exercise questions",
  });

  const now = yield* Clock.currentTimeMillis;
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
  const authorCache = yield* buildAuthorCache(ctx, allAuthorNames);

  for (const question of args.questions) {
    const exerciseSet = yield* Effect.promise(() =>
      ctx.db
        .query("exerciseSets")
        .withIndex("by_locale_and_slug", (query) =>
          query.eq("locale", question.locale).eq("slug", question.setSlug)
        )
        .unique()
    );

    if (!exerciseSet) {
      skipped += 1;
      skippedSetSlugs.add(question.setSlug);
      yield* Effect.logWarning(`Set not found for question: ${question.slug}`);
      continue;
    }

    const existingQuestion = yield* Effect.promise(() =>
      ctx.db
        .query("exerciseQuestions")
        .withIndex("by_locale_and_slug", (query) =>
          query.eq("locale", question.locale).eq("slug", question.slug)
        )
        .unique()
    );
    yield* syncContentSearch({
      contentHash: question.contentHash,
      description: question.searchDescription,
      locale: question.locale,
      route: question.slug,
      section: "exercises",
      syncedAt: now,
      text: question.searchText,
      title: question.searchTitle,
    });

    if (existingQuestion?.contentHash === question.contentHash) {
      unchanged += 1;
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
      yield* Effect.promise(() =>
        ctx.db.patch(existingQuestion._id, {
          ...nextValues,
          syncedAt: now,
        })
      );
      authorLinksCreated += yield* syncContentAuthorsWithCache(
        ctx,
        existingQuestion._id,
        "exercise",
        question.authors,
        authorCache
      );
      choicesCreated += yield* replaceExerciseChoices(ctx, {
        choices: question.choices,
        locale: question.locale,
        questionId: existingQuestion._id,
      });
      updated += 1;
      continue;
    }

    const questionId = yield* Effect.promise(() =>
      ctx.db.insert("exerciseQuestions", {
        ...nextValues,
        locale: question.locale,
        slug: question.slug,
        syncedAt: now,
      })
    );
    authorLinksCreated += yield* syncContentAuthorsWithCache(
      ctx,
      questionId,
      "exercise",
      question.authors,
      authorCache
    );
    choicesCreated += yield* replaceExerciseChoices(ctx, {
      choices: question.choices,
      locale: question.locale,
      questionId,
    });
    created += 1;
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
});

/** Deletes stale exercise sets and their bounded question children. */
export const deleteStaleExerciseSets = Effect.fn(
  "contentSync.exercises.deleteStaleExerciseSets"
)(function* (args: { setIds: Id<"exerciseSets">[] }) {
  const ctx = yield* MutationCtx;
  yield* assertContentSyncBatchSize({
    functionName: "deleteStaleExerciseSets",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleExerciseSets,
    received: args.setIds.length,
    unit: "exercise set IDs",
  });

  let deleted = 0;

  for (const setId of args.setIds) {
    const exerciseSet = yield* Effect.promise(() => ctx.db.get(setId));

    if (!exerciseSet) {
      continue;
    }

    const questions = yield* Effect.promise(() =>
      ctx.db
        .query("exerciseQuestions")
        .withIndex("by_setId", (query) => query.eq("setId", setId))
        .take(exerciseSet.questionCount + 1)
    );

    if (questions.length > exerciseSet.questionCount) {
      return yield* Effect.fail(
        new ContentSyncError({
          message: "Exercise question count exceeds the set question count.",
        })
      );
    }

    for (const question of questions) {
      yield* deleteExerciseQuestion(ctx, question._id);
    }

    const searchRef = buildContentSearchRef({
      locale: exerciseSet.locale,
      route: exerciseSet.slug,
      section: "exercises",
    });
    yield* deleteContentSearch(searchRef.content_id);
    yield* Effect.promise(() => ctx.db.delete(setId));
    deleted += 1;
  }

  return { deleted };
});

/** Deletes stale exercise questions. */
export const deleteStaleExerciseQuestions = Effect.fn(
  "contentSync.exercises.deleteStaleExerciseQuestions"
)(function* (args: { questionIds: Id<"exerciseQuestions">[] }) {
  const ctx = yield* MutationCtx;
  yield* assertContentSyncBatchSize({
    functionName: "deleteStaleExerciseQuestions",
    limit: CONTENT_SYNC_BATCH_LIMITS.staleExerciseQuestions,
    received: args.questionIds.length,
    unit: "exercise question IDs",
  });

  let deleted = 0;

  for (const questionId of args.questionIds) {
    const question = yield* Effect.promise(() => ctx.db.get(questionId));

    if (!question) {
      continue;
    }

    yield* deleteExerciseQuestion(ctx, questionId);
    deleted += 1;
  }

  return { deleted };
});
