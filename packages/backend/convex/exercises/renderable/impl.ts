import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { exerciseSetIntegrityErrorCode } from "@repo/backend/convex/exercises/renderable/spec";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import { ConvexError } from "convex/values";

/**
 * Throws a structured Convex integrity error for synced exercise data.
 */
function throwExerciseSetIntegrityError(message: string) {
  throw new ConvexError({
    code: exerciseSetIntegrityErrorCode,
    message,
  });
}

/**
 * Loads one synced exercise set by its public content slug.
 */
async function getExerciseSet(
  ctx: QueryCtx,
  args: {
    locale: Locale;
    slug: string;
  }
) {
  return await ctx.db
    .query("exerciseSets")
    .withIndex("by_locale_and_slug", (q) =>
      q.eq("locale", args.locale).eq("slug", args.slug)
    )
    .first();
}

/**
 * Loads, sorts, and validates the bounded question rows for a synced set.
 */
async function getOrderedQuestions(ctx: QueryCtx, set: Doc<"exerciseSets">) {
  const questions = await ctx.db
    .query("exerciseQuestions")
    .withIndex("by_setId", (q) => q.eq("setId", set._id))
    .take(set.questionCount + 1);

  if (questions.length > set.questionCount) {
    throwExerciseSetIntegrityError(
      "Exercise set has more synced questions than its declared question count."
    );
  }

  if (questions.length !== set.questionCount) {
    throwExerciseSetIntegrityError(
      "Exercise set question count does not match synced question rows."
    );
  }

  const orderedQuestions = [...questions].sort((a, b) => a.number - b.number);
  const hasContiguousNumbers = orderedQuestions.every(
    (question, index) => question.number === index + 1
  );

  if (!hasContiguousNumbers) {
    throwExerciseSetIntegrityError(
      "Exercise set questions must use contiguous 1-based numbers."
    );
  }

  return orderedQuestions;
}

/**
 * Loads, sorts, and validates bounded choice rows for one synced question.
 */
async function getOrderedChoices(
  ctx: QueryCtx,
  question: Doc<"exerciseQuestions">,
  locale: Locale
) {
  const choices = await ctx.db
    .query("exerciseChoices")
    .withIndex("by_questionId_and_locale", (q) =>
      q.eq("questionId", question._id).eq("locale", locale)
    )
    .take(CONTENT_SYNC_BATCH_LIMITS.exerciseChoices + 1);

  if (choices.length > CONTENT_SYNC_BATCH_LIMITS.exerciseChoices) {
    throwExerciseSetIntegrityError(
      "Exercise question has more synced choices than the content-sync choice limit."
    );
  }

  if (choices.length === 0) {
    throwExerciseSetIntegrityError(
      "Exercise question is missing synced choices."
    );
  }

  return [...choices].sort((a, b) => a.order - b.order);
}

/**
 * Builds the locale-keyed choices shape expected by the shared exercise UI.
 */
function buildRenderableChoices(
  locale: Locale,
  choices: Array<{ isCorrect: boolean; label: string }>
) {
  const renderableChoices = choices.map((choice) => ({
    label: choice.label,
    value: choice.isCorrect,
  }));

  if (locale === "id") {
    return {
      en: [],
      id: renderableChoices,
    };
  }

  return {
    en: renderableChoices,
    id: [],
  };
}

/**
 * Loads renderable exercise rows from the synced Convex content read model.
 */
export async function getRenderableRowsBySlugImpl(
  ctx: QueryCtx,
  args: {
    locale: Locale;
    slug: string;
  }
) {
  const set = await getExerciseSet(ctx, args);

  if (!set) {
    return null;
  }

  const orderedQuestions = await getOrderedQuestions(ctx, set);

  return await Promise.all(
    orderedQuestions.map(async (question) => {
      const orderedChoices = await getOrderedChoices(
        ctx,
        question,
        args.locale
      );

      return {
        choices: buildRenderableChoices(args.locale, orderedChoices),
        number: question.number,
      };
    })
  );
}

/**
 * Loads canonical question IDs and option keys for server-side scoring.
 */
export async function getQuestionAnswerSheetBySlugImpl(
  ctx: QueryCtx,
  args: {
    locale: Locale;
    slug: string;
  }
) {
  const set = await getExerciseSet(ctx, args);

  if (!set) {
    return [];
  }

  const orderedQuestions = await getOrderedQuestions(ctx, set);

  return await Promise.all(
    orderedQuestions.map(async (question) => {
      const choices = await getOrderedChoices(ctx, question, args.locale);

      return {
        exerciseNumber: question.number,
        options: choices.map((choice) => ({
          optionKey: choice.optionKey,
          order: choice.order,
        })),
        questionId: question._id,
      };
    })
  );
}
