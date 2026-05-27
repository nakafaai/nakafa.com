import type { Doc, Id } from "@repo/backend/confect/_generated/dataModel";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { requireAppUser } from "@repo/backend/confect/modules/identity/auth.service";
import { applyAttemptAggregatesDelta } from "@repo/backend/confect/modules/learning/exerciseAttemptUtils.service";
import type { ConvexMutationCtx } from "@repo/backend/confect/modules/shared/convexContext";
import { syncTryoutExerciseAttemptExpiry } from "@repo/backend/confect/modules/tryout/tryoutExpiry.service";
import { getManyFrom } from "convex-helpers/server/relationships";
import { Clock, Effect } from "effect";
import { failExercise } from "./errors.service";

/** Scores one answer against its question choices. */
const scoreExerciseAnswer = Effect.fn("exercises.scoreExerciseAnswer")(
  function* (
    db: ConvexMutationCtx["db"],
    args: {
      readonly attempt: Doc<"exerciseAttempts">;
      readonly exerciseNumber: number;
      readonly questionId: Id<"exerciseQuestions">;
      readonly selectedOptionId: string;
    }
  ) {
    const question = yield* Effect.promise(() => db.get(args.questionId));

    if (!question) {
      return yield* failExercise("QUESTION_NOT_FOUND", "Question not found.");
    }

    const set = yield* Effect.promise(() => db.get(question.setId));

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

    const choices = yield* Effect.promise(() =>
      getManyFrom(
        db,
        "exerciseChoices",
        "by_questionId_and_locale",
        args.questionId,
        "questionId"
      )
    );
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
    const ctx = yield* MutationCtx;
    const { appUser } = yield* requireAppUser(ctx);
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

    const attempt = yield* loadOwnedInProgressAttempt(ctx, {
      attemptId: args.attemptId,
      userId: appUser._id,
    });
    const expiresAtMs = attempt.startedAt + attempt.timeLimit * 1e3;
    const tryoutExpiry = yield* syncTryoutExerciseAttemptExpiry(
      ctx,
      attempt,
      now
    );

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

    const existingAnswer = yield* Effect.promise(() =>
      ctx.db
        .query("exerciseAnswers")
        .withIndex("by_attemptId_and_exerciseNumber", (query) =>
          query
            .eq("attemptId", args.attemptId)
            .eq("exerciseNumber", args.exerciseNumber)
        )
        .first()
    );
    const scoredAnswer = yield* scoreExerciseAnswer(ctx.db, {
      attempt,
      exerciseNumber: args.exerciseNumber,
      questionId: args.questionId,
      selectedOptionId: args.selectedOptionId,
    });

    if (existingAnswer) {
      yield* Effect.promise(() =>
        ctx.db.patch(existingAnswer._id, {
          isCorrect: scoredAnswer.isCorrect,
          questionId: scoredAnswer.questionId,
          selectedOptionId: scoredAnswer.selectedOptionId,
          textAnswer: scoredAnswer.textAnswer,
          timeSpent: args.timeSpent,
          updatedAt: now,
        })
      );
      yield* applyAnswerAggregateDelta(ctx, attempt, {
        deltaAnsweredCount: 0,
        deltaCorrectAnswers:
          (scoredAnswer.isCorrect ? 1 : 0) - (existingAnswer.isCorrect ? 1 : 0),
        deltaTotalTime: args.timeSpent - existingAnswer.timeSpent,
        now,
      });
      return null;
    }

    yield* Effect.promise(() =>
      ctx.db.insert("exerciseAnswers", {
        answeredAt: now,
        attemptId: args.attemptId,
        exerciseNumber: args.exerciseNumber,
        isCorrect: scoredAnswer.isCorrect,
        questionId: scoredAnswer.questionId,
        selectedOptionId: scoredAnswer.selectedOptionId,
        textAnswer: scoredAnswer.textAnswer,
        timeSpent: args.timeSpent,
        updatedAt: now,
      })
    );
    yield* applyAnswerAggregateDelta(ctx, attempt, {
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
)(function* (
  ctx: ConvexMutationCtx,
  args: {
    readonly attemptId: Id<"exerciseAttempts">;
    readonly userId: Id<"users">;
  }
) {
  const attempt = yield* Effect.promise(() => ctx.db.get(args.attemptId));

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
  ctx: ConvexMutationCtx,
  attempt: Doc<"exerciseAttempts">,
  args: {
    readonly deltaAnsweredCount: number;
    readonly deltaCorrectAnswers: number;
    readonly deltaTotalTime: number;
    readonly now: number;
  }
) {
  const next = applyAttemptAggregatesDelta({
    attempt,
    deltaAnsweredCount: args.deltaAnsweredCount,
    deltaCorrectAnswers: args.deltaCorrectAnswers,
    deltaTotalTime: args.deltaTotalTime,
  });

  yield* Effect.promise(() =>
    ctx.db.patch(attempt._id, {
      ...next,
      lastActivityAt: args.now,
      updatedAt: args.now,
    })
  );
});
