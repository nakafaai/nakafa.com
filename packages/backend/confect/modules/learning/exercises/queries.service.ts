import { DatabaseReader } from "@repo/backend/confect/_generated/services";
import type { Locale } from "@repo/backend/confect/modules/content/content.schemas";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth/session.service";
import { Effect, Option } from "effect";

/** Loads the latest standalone set attempt and its answers for the current user. */
export const getLatestAttemptBySlug = Effect.fnUntraced(function* (args: {
  readonly slug: string;
}) {
  const reader = yield* DatabaseReader;
  const { appUser } = yield* requireAppUser();
  const attempt = yield* reader
    .table("exerciseAttempts")
    .index(
      "by_userId_and_origin_and_slug_and_scope_and_startedAt",
      (query) =>
        query
          .eq("userId", appUser._id)
          .eq("origin", "standalone")
          .eq("slug", args.slug)
          .eq("scope", "set"),
      "desc"
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!attempt) {
    return null;
  }

  const answers = yield* reader
    .table("exerciseAnswers")
    .index("by_attemptId_and_exerciseNumber", (query) =>
      query.eq("attemptId", attempt._id)
    )
    .collect();

  return { answers, attempt };
});

/** Loads the answer sheet for a synced exercise set. */
export const getQuestionAnswerSheetBySlug = Effect.fnUntraced(function* (args: {
  readonly locale: Locale;
  readonly slug: string;
}) {
  const reader = yield* DatabaseReader;
  yield* requireAppUser();

  const set = yield* reader
    .table("exerciseSets")
    .index("by_locale_and_slug", (query) =>
      query.eq("locale", args.locale).eq("slug", args.slug)
    )
    .first()
    .pipe(Effect.map(Option.getOrNull));

  if (!set) {
    return [];
  }

  const questions = yield* reader
    .table("exerciseQuestions")
    .index("by_setId", (query) => query.eq("setId", set._id))
    .collect();
  const orderedQuestions = [...questions].sort(
    (left, right) => left.number - right.number
  );
  const answerSheet = yield* Effect.forEach(orderedQuestions, (question) =>
    Effect.gen(function* () {
      const choices = yield* reader
        .table("exerciseChoices")
        .index("by_questionId_and_locale", (query) =>
          query.eq("questionId", question._id)
        )
        .collect();

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
