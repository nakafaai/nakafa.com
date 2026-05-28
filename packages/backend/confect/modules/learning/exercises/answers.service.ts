import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import {
  DatabaseReader,
  DatabaseWriter,
} from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { applyAttemptAggregatesDelta } from "@repo/backend/confect/modules/learning/exerciseAttemptUtils.service";
import { failExercise } from "@repo/backend/confect/modules/learning/exercises/errors.service";
import { syncTryoutExerciseAttemptExpiry } from "@repo/backend/confect/modules/tryout/tryoutExpiry.service";
import { Clock, Effect, Option } from "effect";

/** Scores one answer against its question choices. */
const scoreExerciseAnswer = Effect.fn("exercises.scoreExerciseAnswer")(
  function* (args: {
    readonly attempt: Doc<"exerciseAttempts">;
    readonly exerciseNumber: number;
    readonly questionId: Id<"exerciseQuestions">;
    readonly selectedOptionId: string;
  }) {
    const reader = yield* DatabaseReader;
    const question = yield* reader
      .table("exerciseQuestions")
      .get(args.questionId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!question) {
      return yield* failExercise("QUESTION_NOT_FOUND", "Question not found.");
    }

    const set = yield* reader
      .table("exerciseSets")
      .get(question.setId)
      .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

    if (!set || set.slug !== args.attempt.slug) {
      return yield* failExercise(
        "INVALID_QUESTION",
        "Question does not belong to this attempt."
      );
    }

    if (question.number !== args.exerciseNumber) {
      return yield* failExercise(
        "INVALID_ARGUMENT",
        "exerciseNumber does not match the provided question."
      );
    }

    if (
      args.attempt.scope === "single" &&
      args.attempt.exerciseNumber !== args.exerciseNumber
    ) {
      return yield* failExercise(
        "INVALID_ARGUMENT",
        "exerciseNumber does not match this single-scope attempt."
      );
    }

    const choices = yield* reader
      .table("exerciseChoices")
      .index("by_questionId_and_locale", (query) =>
        query.eq("questionId", args.questionId)
      )
      .collect();
    const selectedChoice =
      choices.find((choice) => choice.optionKey === args.selectedOptionId) ??
      null;

    if (!selectedChoice) {
      return yield* failExercise(
        "INVALID_ARGUMENT",
        "selectedOptionId does not belong to the provided question."
      );
    }

    return {
      isCorrect: selectedChoice.isCorrect,
      questionId: args.questionId,
      selectedOptionId: selectedChoice.optionKey,
      textAnswer: selectedChoice.label,
    };
  }
);

/** Submits or updates one answer on an in-progress attempt. */
export const submitAnswer = Effect.fn("exercises.submitAnswer")(
  function* (args: {
    readonly attemptId: Id<"exerciseAttempts">;
    readonly exerciseNumber: number;
    readonly questionId: Id<"exerciseQuestions">;
    readonly selectedOptionId: string;
    readonly timeSpent: number;
  }) {
    const reader = yield* DatabaseReader;
    const writer = yield* DatabaseWriter;
    const { appUser } = yield* requireAppUser();
    const now = yield* Clock.currentTimeMillis;

    if (args.exerciseNumber < 1) {
      return yield* failExercise(
        "INVALID_ARGUMENT",
        "exerciseNumber must be at least 1."
      );
    }

    if (args.timeSpent < 0) {
      return yield* failExercise(
        "INVALID_ARGUMENT",
        "timeSpent cannot be negative."
      );
    }

    const attempt = yield* loadOwnedInProgressAttempt({
      attemptId: args.attemptId,
      userId: appUser._id,
    });
    const expiresAtMs = attempt.startedAt + attempt.timeLimit * 1e3;
    const tryoutExpiry = yield* syncTryoutExerciseAttemptExpiry(attempt, now);

    if (tryoutExpiry.expired) {
      return yield* failExercise(
        "TRYOUT_EXPIRED",
        "This tryout has expired.",
        tryoutExpiry.expiredAtMs
      );
    }

    if (now >= expiresAtMs) {
      return yield* failExercise(
        "TIME_EXPIRED",
        "Time has expired for this attempt.",
        expiresAtMs
      );
    }

    const existingAnswer = yield* reader
      .table("exerciseAnswers")
      .index("by_attemptId_and_exerciseNumber", (query) =>
        query
          .eq("attemptId", args.attemptId)
          .eq("exerciseNumber", args.exerciseNumber)
      )
      .first()
      .pipe(Effect.map(Option.getOrNull));
    const scoredAnswer = yield* scoreExerciseAnswer({
      attempt,
      exerciseNumber: args.exerciseNumber,
      questionId: args.questionId,
      selectedOptionId: args.selectedOptionId,
    });

    if (existingAnswer) {
      yield* writer.table("exerciseAnswers").patch(existingAnswer._id, {
        isCorrect: scoredAnswer.isCorrect,
        questionId: scoredAnswer.questionId,
        selectedOptionId: scoredAnswer.selectedOptionId,
        textAnswer: scoredAnswer.textAnswer,
        timeSpent: args.timeSpent,
        updatedAt: now,
      });
      yield* applyAnswerAggregateDelta(attempt, {
        deltaAnsweredCount: 0,
        deltaCorrectAnswers:
          (scoredAnswer.isCorrect ? 1 : 0) - (existingAnswer.isCorrect ? 1 : 0),
        deltaTotalTime: args.timeSpent - existingAnswer.timeSpent,
        now,
      });
      return null;
    }

    yield* writer.table("exerciseAnswers").insert({
      answeredAt: now,
      attemptId: args.attemptId,
      exerciseNumber: args.exerciseNumber,
      isCorrect: scoredAnswer.isCorrect,
      questionId: scoredAnswer.questionId,
      selectedOptionId: scoredAnswer.selectedOptionId,
      textAnswer: scoredAnswer.textAnswer,
      timeSpent: args.timeSpent,
      updatedAt: now,
    });
    yield* applyAnswerAggregateDelta(attempt, {
      deltaAnsweredCount: 1,
      deltaCorrectAnswers: scoredAnswer.isCorrect ? 1 : 0,
      deltaTotalTime: args.timeSpent,
      now,
    });

    return null;
  }
);

/** Loads an owned attempt that can still accept answers. */
const loadOwnedInProgressAttempt = Effect.fn(
  "exercises.loadOwnedInProgressAttempt"
)(function* (args: {
  readonly attemptId: Id<"exerciseAttempts">;
  readonly userId: Id<"users">;
}) {
  const reader = yield* DatabaseReader;
  const attempt = yield* reader
    .table("exerciseAttempts")
    .get(args.attemptId)
    .pipe(Effect.catchTag("GetByIdFailure", () => Effect.succeed(null)));

  if (!attempt) {
    return yield* failExercise("ATTEMPT_NOT_FOUND", "Attempt not found.");
  }

  if (attempt.userId !== args.userId) {
    return yield* failExercise(
      "FORBIDDEN",
      "You do not have access to this attempt."
    );
  }

  if (attempt.status !== "in-progress") {
    return yield* failExercise(
      "INVALID_ATTEMPT_STATUS",
      "Attempt is not in progress."
    );
  }

  return attempt;
});

/** Applies answer aggregate deltas directly to the owning attempt. */
const applyAnswerAggregateDelta = Effect.fn(
  "exercises.applyAnswerAggregateDelta"
)(function* (
  attempt: Doc<"exerciseAttempts">,
  args: {
    readonly deltaAnsweredCount: number;
    readonly deltaCorrectAnswers: number;
    readonly deltaTotalTime: number;
    readonly now: number;
  }
) {
  const writer = yield* DatabaseWriter;
  const next = applyAttemptAggregatesDelta({
    attempt,
    deltaAnsweredCount: args.deltaAnsweredCount,
    deltaCorrectAnswers: args.deltaCorrectAnswers,
    deltaTotalTime: args.deltaTotalTime,
  });

  yield* writer.table("exerciseAttempts").patch(attempt._id, {
    ...next,
    lastActivityAt: args.now,
    updatedAt: args.now,
  });
});
