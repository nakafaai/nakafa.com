import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { finalizedAttemptStatusSchema } from "@repo/backend/confect/modules/learning/attempts.schemas";
import { ExerciseError } from "@repo/backend/confect/modules/learning/exercises/errors.service";
import {
  ExerciseAnswers,
  ExerciseAttempts,
  exerciseAttemptModeSchema,
  exerciseAttemptScopeSchema,
} from "@repo/backend/confect/modules/learning/exercises.tables";
import { Schema } from "effect";

const exercisesMutationsGroup = GroupSpec.make("mutations")
  .addFunction(
    FunctionSpec.publicMutation({
      name: "completeAttempt",
      args: Schema.Struct({
        attemptId: GenericId.GenericId("exerciseAttempts"),
      }),
      returns: Schema.Struct({
        expiredAtMs: Schema.optional(Schema.Number),
        status: finalizedAttemptStatusSchema,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "expireAttemptInternal",
      args: Schema.Struct({
        attemptId: GenericId.GenericId("exerciseAttempts"),
        expiresAtMs: Schema.Number,
      }),
      returns: Schema.Null,
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "startAttempt",
      args: Schema.Struct({
        exerciseNumber: Schema.optional(Schema.Number),
        mode: exerciseAttemptModeSchema,
        perQuestionTimeLimit: Schema.optional(Schema.Number),
        scope: exerciseAttemptScopeSchema,
        slug: Schema.String,
        timeLimit: Schema.Number,
        totalExercises: Schema.Number,
      }),
      returns: GenericId.GenericId("exerciseAttempts"),
    })
  )
  .addFunction(
    FunctionSpec.publicMutation({
      name: "submitAnswer",
      args: Schema.Struct({
        attemptId: GenericId.GenericId("exerciseAttempts"),
        exerciseNumber: Schema.Number,
        questionId: GenericId.GenericId("exerciseQuestions"),
        selectedOptionId: Schema.String,
        timeSpent: Schema.Number,
      }),
      error: ExerciseError,
      returns: Schema.Null,
    })
  );

export { exercisesMutationsGroup };

const exercisesQueriesGroup = GroupSpec.make("queries")
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getLatestAttemptBySlug",
      args: Schema.Struct({ slug: Schema.String }),
      returns: Schema.Union(
        Schema.Null,
        Schema.Struct({
          answers: Schema.Array(ExerciseAnswers.Doc),
          attempt: ExerciseAttempts.Doc,
        })
      ),
    })
  )
  .addFunction(
    FunctionSpec.publicQuery({
      name: "getQuestionAnswerSheetBySlug",
      args: Schema.Struct({
        locale: localeSchema,
        slug: Schema.String,
      }),
      returns: Schema.Array(
        Schema.Struct({
          exerciseNumber: Schema.Number,
          options: Schema.Array(
            Schema.Struct({ optionKey: Schema.String, order: Schema.Number })
          ),
          questionId: GenericId.GenericId("exerciseQuestions"),
        })
      ),
    })
  );

export { exercisesQueriesGroup };

const exercisesGroup = GroupSpec.make("exercises")
  .addGroup(exercisesMutationsGroup)
  .addGroup(exercisesQueriesGroup);

export { exercisesGroup };
