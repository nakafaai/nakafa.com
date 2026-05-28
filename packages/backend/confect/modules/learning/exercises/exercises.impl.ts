import { FunctionImpl, GroupImpl } from "@confect/server";
import api from "@repo/backend/confect/_generated/api";
import { submitAnswer as exerciseAnswers_submitAnswer } from "@repo/backend/confect/modules/learning/exercises/answers.service";
import {
  completeAttempt as exerciseAttempts_completeAttempt,
  expireAttemptInternal as exerciseAttempts_expireAttemptInternal,
  startAttempt as exerciseAttempts_startAttempt,
} from "@repo/backend/confect/modules/learning/exercises/attempts.service";
import { ExerciseError } from "@repo/backend/confect/modules/learning/exercises/errors.service";
import {
  getLatestAttemptBySlug as exerciseQueries_getLatestAttemptBySlug,
  getQuestionAnswerSheetBySlug as exerciseQueries_getQuestionAnswerSheetBySlug,
} from "@repo/backend/confect/modules/learning/exercises/queries.service";
import { Effect, Layer } from "effect";

const exercises_mutations_completeAttemptImpl = FunctionImpl.make(
  api,
  "exercises.mutations",
  "completeAttempt",
  (args) =>
    exerciseAttempts_completeAttempt(args).pipe(
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
    exerciseAttempts_expireAttemptInternal(args).pipe(
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
    exerciseAttempts_startAttempt(args).pipe(
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
    exerciseAnswers_submitAnswer(args).pipe(
      Effect.catchTag("TryoutError", (error) =>
        Effect.fail(
          new ExerciseError({
            code: error.code,
            message: error.message,
          })
        )
      ),
      Effect.catchTags({
        UnauthorizedUser: (error) => Effect.die(error),
      })
    )
);

const exercises_queries_getLatestAttemptBySlugImpl = FunctionImpl.make(
  api,
  "exercises.queries",
  "getLatestAttemptBySlug",
  (args) =>
    exerciseQueries_getLatestAttemptBySlug(args).pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error))
    )
);

const exercises_queries_getQuestionAnswerSheetBySlugImpl = FunctionImpl.make(
  api,
  "exercises.queries",
  "getQuestionAnswerSheetBySlug",
  (args) =>
    exerciseQueries_getQuestionAnswerSheetBySlug(args).pipe(
      Effect.catchTag("UnauthorizedUser", (error) => Effect.die(error))
    )
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
