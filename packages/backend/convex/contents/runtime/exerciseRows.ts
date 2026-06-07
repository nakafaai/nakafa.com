import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import {
  formatContentDate,
  getContentAuthors,
  throwRuntimeIntegrityError,
} from "@repo/backend/convex/contents/runtime/shared";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";

/** Loads one synced exercise set by public slug. */
export async function getExerciseSet(
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
    .unique();
}

/** Loads, sorts, and validates question rows for one synced set. */
export async function getExerciseQuestions(
  ctx: QueryCtx,
  set: Doc<"exerciseSets">
) {
  const questions = await ctx.db
    .query("exerciseQuestions")
    .withIndex("by_setId", (q) => q.eq("setId", set._id))
    .take(set.questionCount + 1);

  if (questions.length > set.questionCount) {
    throwRuntimeIntegrityError("Exercise set has extra synced questions.");
  }

  if (questions.length !== set.questionCount) {
    throwRuntimeIntegrityError(
      "Exercise question count does not match the set."
    );
  }

  const orderedQuestions = [...questions].sort(
    (left, right) => left.number - right.number
  );
  const hasContiguousNumbers = orderedQuestions.every(
    (question, index) => question.number === index + 1
  );

  if (!hasContiguousNumbers) {
    throwRuntimeIntegrityError(
      "Exercise questions must use contiguous numbers."
    );
  }

  return orderedQuestions;
}

/** Loads and validates one question's choices. */
async function getExerciseChoices(
  ctx: QueryCtx,
  question: Doc<"exerciseQuestions">
) {
  const choices = await ctx.db
    .query("exerciseChoices")
    .withIndex("by_questionId_and_locale", (q) =>
      q.eq("questionId", question._id).eq("locale", question.locale)
    )
    .take(CONTENT_SYNC_BATCH_LIMITS.exerciseChoices + 1);

  if (choices.length > CONTENT_SYNC_BATCH_LIMITS.exerciseChoices) {
    throwRuntimeIntegrityError("Exercise choice count exceeds the sync limit.");
  }

  if (choices.length === 0) {
    throwRuntimeIntegrityError("Exercise question is missing choices.");
  }

  return choices.sort((left, right) => left.order - right.order);
}

/** Builds the locale-keyed choices shape used by exercise UI and llms routes. */
function buildExerciseChoices(
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

/** Builds one runtime exercise row from synced question, answer, and choices. */
export async function buildRuntimeExercise(
  ctx: QueryCtx,
  question: Doc<"exerciseQuestions">
) {
  const [authors, choices] = await Promise.all([
    getContentAuthors(ctx, {
      contentId: question._id,
      contentType: "exercise",
    }),
    getExerciseChoices(ctx, question),
  ]);
  const date = formatContentDate(question.date);

  return {
    answer: {
      metadata: {
        authors,
        date,
        title:
          question.locale === "id"
            ? `Pembahasan ${question.title}`
            : `Solution to ${question.title}`,
      },
      raw: question.answerBody,
    },
    choices: buildExerciseChoices(question.locale, choices),
    contentHash: question.contentHash,
    number: question.number,
    question: {
      metadata: {
        authors,
        date,
        description: question.description,
        title: question.title,
      },
      raw: question.questionBody,
    },
  };
}
