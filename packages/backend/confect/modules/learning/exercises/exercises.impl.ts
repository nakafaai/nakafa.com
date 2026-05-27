import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import * as exercise_answers from "@repo/backend/confect/modules/learning/exercises/answers.service";
import * as exercise_attempts from "@repo/backend/confect/modules/learning/exercises/attempts.service";
import * as exercise_queries from "@repo/backend/confect/modules/learning/exercises/queries.service";
import { Effect, Layer } from "effect";

const exercises_mutations_completeAttemptImpl = FunctionImpl.make(
  api,
  "exercises.mutations",
  "completeAttempt",
  (args) =>
    exercise_attempts.completeAttempt(args).pipe(
      Effect.catchTags({
        ExerciseError: (error) => Effect.die(error),
      })
    )
);

const exercises_mutations_expireAttemptInternalImpl = FunctionImpl.make(
  api,
  "exercises.mutations",
  "expireAttemptInternal",
  (args) =>
    exercise_attempts.expireAttemptInternal(args).pipe(
      Effect.catchTags({
        IrtError: (error) => Effect.die(error),
        TryoutError: (error) => Effect.die(error),
      })
    )
);

const exercises_mutations_startAttemptImpl = FunctionImpl.make(
  api,
  "exercises.mutations",
  "startAttempt",
  (args) =>
    exercise_attempts.startAttempt(args).pipe(
      Effect.catchTags({
        ExerciseError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const exercises_mutations_submitAnswerImpl = FunctionImpl.make(
  api,
  "exercises.mutations",
  "submitAnswer",
  (args) =>
    exercise_answers.submitAnswer(args).pipe(
      Effect.catchTags({
        ExerciseError: (error) => Effect.die(error),
        TryoutError: (error) => Effect.die(error),
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const exercises_queries_getLatestAttemptBySlugImpl = FunctionImpl.make(
  api,
  "exercises.queries",
  "getLatestAttemptBySlug",
  (args) =>
    exercise_queries
      .getLatestAttemptBySlug(args)
      .pipe(Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)))
);

const exercises_queries_getQuestionAnswerSheetBySlugImpl = FunctionImpl.make(
  api,
  "exercises.queries",
  "getQuestionAnswerSheetBySlug",
  (args) =>
    exercise_queries
      .getQuestionAnswerSheetBySlug(args)
      .pipe(Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error)))
);

const exercisesMutationsImpl = GroupImpl.make(api, "exercises.mutations")
  .pipe(Layer.provide(exercises_mutations_completeAttemptImpl))
  .pipe(Layer.provide(exercises_mutations_expireAttemptInternalImpl))
  .pipe(Layer.provide(exercises_mutations_startAttemptImpl))
  .pipe(Layer.provide(exercises_mutations_submitAnswerImpl));

const exercisesQueriesImpl = GroupImpl.make(api, "exercises.queries")
  .pipe(Layer.provide(exercises_queries_getLatestAttemptBySlugImpl))
  .pipe(Layer.provide(exercises_queries_getQuestionAnswerSheetBySlugImpl));

const exercisesImpl = GroupImpl.make(api, "exercises")
  .pipe(Layer.provide(exercisesMutationsImpl))
  .pipe(Layer.provide(exercisesQueriesImpl));

export const exercisesLayer = Layer.mergeAll(exercisesImpl);
