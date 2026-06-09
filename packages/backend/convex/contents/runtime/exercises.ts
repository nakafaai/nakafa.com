import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import {
  buildRuntimeExercise,
  getExerciseQuestions,
  getExerciseSet,
} from "@repo/backend/convex/contents/runtime/exerciseRows";
import { throwRuntimeIntegrityError } from "@repo/backend/convex/contents/runtime/shared";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { compareExerciseSetSlugs } from "@repo/contents/_lib/exercises/slug";

/** Loads a full exercise set page from the durable content read model. */
export async function getExerciseSetPageImpl(
  ctx: QueryCtx,
  args: {
    locale: Locale;
    slug: string;
  }
) {
  const set = await getExerciseSet(ctx, args);

  if (!set || set.questionCount <= 0) {
    return null;
  }

  const questions = await getExerciseQuestions(ctx, set);
  const exercises = await Promise.all(
    questions.map((question) => buildRuntimeExercise(ctx, question))
  );

  return {
    category: set.category,
    description: set.description,
    exerciseType: set.exerciseType,
    exercises,
    material: set.material,
    questionCount: set.questionCount,
    setName: set.setName,
    slug: set.slug,
    syncedAt: set.syncedAt,
    title: set.title,
    type: set.type,
    year: set.year,
  };
}

/** Loads one question-level exercise route from the durable content read model. */
export async function getExerciseQuestionPageImpl(
  ctx: QueryCtx,
  args: {
    locale: Locale;
    slug: string;
  }
) {
  const question = await ctx.db
    .query("exerciseQuestions")
    .withIndex("by_locale_and_slug", (q) =>
      q.eq("locale", args.locale).eq("slug", args.slug)
    )
    .unique();

  if (!question) {
    return null;
  }

  const set = await ctx.db.get(question.setId);

  if (!set) {
    throwRuntimeIntegrityError("Exercise question points to a missing set.");
  }

  return {
    exercise: await buildRuntimeExercise(ctx, question),
    exerciseCount: set.questionCount,
    set: {
      category: set.category,
      description: set.description,
      exerciseType: set.exerciseType,
      material: set.material,
      questionCount: set.questionCount,
      setName: set.setName,
      slug: set.slug,
      title: set.title,
      type: set.type,
      year: set.year,
    },
  };
}

/** Loads a year or exercise-type group route from synced exercise set rows. */
export async function getExerciseGroupPageImpl(
  ctx: QueryCtx,
  args: {
    category: Doc<"exerciseSets">["category"];
    exerciseType: string;
    locale: Locale;
    material: Doc<"exerciseSets">["material"];
    type: Doc<"exerciseSets">["type"];
    year?: string;
  }
) {
  const sets = await ctx.db
    .query("exerciseSets")
    .withIndex("by_locale_and_group", (q) =>
      q
        .eq("locale", args.locale)
        .eq("category", args.category)
        .eq("type", args.type)
        .eq("material", args.material)
        .eq("exerciseType", args.exerciseType)
        .eq("year", args.year)
    )
    .take(CONTENT_SYNC_BATCH_LIMITS.exerciseSets + 1);

  if (sets.length > CONTENT_SYNC_BATCH_LIMITS.exerciseSets) {
    throwRuntimeIntegrityError(
      "Exercise group set count exceeds the sync limit."
    );
  }

  const publishedSets = sets
    .filter((set) => set.questionCount > 0)
    .sort((left, right) =>
      compareExerciseSetSlugs(left.setName, right.setName)
    );

  if (publishedSets.length === 0) {
    return null;
  }

  return {
    category: args.category,
    exerciseType: args.exerciseType,
    material: args.material,
    sets: publishedSets.map((set) => ({
      questionCount: set.questionCount,
      setName: set.setName,
      slug: set.slug,
      title: set.title,
      year: set.year,
    })),
    type: args.type,
    year: args.year,
  };
}
