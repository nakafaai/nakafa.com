import { QueryCtx } from "@repo/backend/confect/_generated/services";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { getManyFrom } from "convex-helpers/server/relationships";
import { Effect } from "effect";

/** Loads the latest standalone set attempt and its answers for the current user. */
export const getLatestAttemptBySlug = Effect.fn(
  "exercises.getLatestAttemptBySlug"
)(function* (args: { readonly slug: string }) {
  const ctx = yield* QueryCtx;
  const { appUser } = yield* requireAppUser(ctx);
  const attempt = yield* Effect.promise(() =>
    ctx.db
      .query("exerciseAttempts")
      .withIndex(
        "by_userId_and_origin_and_slug_and_scope_and_startedAt",
        (query) =>
          query
            .eq("userId", appUser._id)
            .eq("origin", "standalone")
            .eq("slug", args.slug)
            .eq("scope", "set")
      )
      .order("desc")
      .first()
  );

  if (!attempt) {
    return null;
  }

  const answers = yield* Effect.promise(() =>
    getManyFrom(
      ctx.db,
      "exerciseAnswers",
      "by_attemptId_and_exerciseNumber",
      attempt._id,
      "attemptId"
    )
  );

  return { answers, attempt };
});

/** Loads the answer sheet for a synced exercise set. */
export const getQuestionAnswerSheetBySlug = Effect.fn(
  "exercises.getQuestionAnswerSheetBySlug"
)(function* (args: { readonly locale: Locale; readonly slug: string }) {
  const ctx = yield* QueryCtx;
  yield* requireAppUser(ctx);

  const set = yield* Effect.promise(() =>
    ctx.db
      .query("exerciseSets")
      .withIndex("by_locale_and_slug", (query) =>
        query.eq("locale", args.locale).eq("slug", args.slug)
      )
      .first()
  );

  if (!set) {
    return [];
  }

  const questions = yield* Effect.promise(() =>
    getManyFrom(ctx.db, "exerciseQuestions", "by_setId", set._id)
  );
  const orderedQuestions = [...questions].sort(
    (left, right) => left.number - right.number
  );
  const answerSheet = yield* Effect.forEach(orderedQuestions, (question) =>
    Effect.gen(function* () {
      const choices = yield* Effect.promise(() =>
        getManyFrom(
          ctx.db,
          "exerciseChoices",
          "by_questionId_and_locale",
          question._id,
          "questionId"
        )
      );

      return {
        exerciseNumber: question.number,
        options: choices
          .map((choice) => ({
            optionKey: choice.optionKey,
            order: choice.order,
          }))
          .sort((left, right) => left.order - right.order),
        questionId: question._id,
      };
    })
  );

  return answerSheet;
});
