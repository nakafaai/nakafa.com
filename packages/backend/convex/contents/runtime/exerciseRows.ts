import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type { QueryCtx } from "@repo/backend/convex/_generated/server";
import { CONTENT_SYNC_BATCH_LIMITS } from "@repo/backend/convex/contentSync/constants";
import { NAKAFA_CONTENT_BASE_URL } from "@repo/backend/convex/contents/constants";
import {
  formatContentDate,
  getContentAuthors,
  throwRuntimeIntegrityError,
} from "@repo/backend/convex/contents/runtime/shared";
import type { Locale } from "@repo/backend/convex/lib/validators/contents";

const exerciseRouteKinds = [
  "exercise-question",
  "exercise-set",
] satisfies readonly Doc<"contentRoutes">["kind"][];

type ExerciseRouteKind = (typeof exerciseRouteKinds)[number];

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

/** Loads the route-catalog graph projection for one exercise runtime row. */
export async function getExerciseRouteProjection(
  ctx: QueryCtx,
  args: {
    kind: ExerciseRouteKind;
    locale: Locale;
    route: string;
  }
) {
  const route = await ctx.db
    .query("contentRoutes")
    .withIndex("by_locale_and_route", (q) =>
      q.eq("locale", args.locale).eq("route", args.route)
    )
    .unique();

  if (
    !route ||
    route.kind !== args.kind ||
    route.content_id !== route.assetId
  ) {
    return null;
  }

  return {
    alignmentId: route.alignmentId,
    assetId: route.assetId,
    conceptId: route.conceptId,
    content_id: route.content_id,
    learningObjectId: route.learningObjectId,
    lensId: route.lensId,
    locale: route.locale,
    route: route.route,
    url: `${NAKAFA_CONTENT_BASE_URL}/${route.locale}/${route.route}`,
  };
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
  const choiceLimit = CONTENT_SYNC_BATCH_LIMITS.exerciseChoices * 2;
  const choices = await ctx.db
    .query("exerciseChoices")
    .withIndex("by_questionId_and_locale", (q) =>
      q.eq("questionId", question._id)
    )
    .take(choiceLimit + 1);

  if (choices.length > choiceLimit) {
    throwRuntimeIntegrityError("Exercise choice count exceeds the sync limit.");
  }

  const localeChoices = {
    en: choices.filter((choice) => choice.locale === "en"),
    id: choices.filter((choice) => choice.locale === "id"),
  };

  if (
    localeChoices.en.length > CONTENT_SYNC_BATCH_LIMITS.exerciseChoices ||
    localeChoices.id.length > CONTENT_SYNC_BATCH_LIMITS.exerciseChoices
  ) {
    throwRuntimeIntegrityError("Exercise choice count exceeds the sync limit.");
  }

  if (localeChoices.en.length === 0 || localeChoices.id.length === 0) {
    throwRuntimeIntegrityError("Exercise question is missing locale choices.");
  }

  return {
    en: localeChoices.en.sort((left, right) => left.order - right.order),
    id: localeChoices.id.sort((left, right) => left.order - right.order),
  };
}

/** Builds the locale-keyed choices shape used by exercise UI and llms routes. */
function buildExerciseChoices(choices: {
  en: Array<{ isCorrect: boolean; label: string }>;
  id: Array<{ isCorrect: boolean; label: string }>;
}) {
  return {
    en: choices.en.map((choice) => ({
      label: choice.label,
      value: choice.isCorrect,
    })),
    id: choices.id.map((choice) => ({
      label: choice.label,
      value: choice.isCorrect,
    })),
  };
}

/** Builds one runtime exercise row from synced question, answer, and choices. */
export async function buildRuntimeExercise(
  ctx: QueryCtx,
  question: Doc<"exerciseQuestions">
) {
  const [authors, choices, graph] = await Promise.all([
    getContentAuthors(ctx, {
      contentId: question._id,
      contentType: "material",
    }),
    getExerciseChoices(ctx, question),
    getExerciseRouteProjection(ctx, {
      kind: "exercise-question",
      locale: question.locale,
      route: question.slug,
    }),
  ]);

  if (!graph) {
    return null;
  }

  const date = formatContentDate(question.date);

  return {
    ...graph,
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
    choices: buildExerciseChoices(choices),
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
