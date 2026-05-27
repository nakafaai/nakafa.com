import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import { localeSchema } from "@repo/backend/confect/modules/content/content.schemas";
import { ExerciseError } from "@repo/backend/confect/modules/learning/exercises/errors.service";
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
        status: Schema.Literal("completed", "expired"),
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
        mode: Schema.Literal("practice", "simulation"),
        perQuestionTimeLimit: Schema.optional(Schema.Number),
        scope: Schema.Literal("set", "single"),
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
          answers: Schema.Array(
            Schema.Struct({
              _creationTime: Schema.Number,
              _id: GenericId.GenericId("exerciseAnswers"),
              answeredAt: Schema.Number,
              attemptId: GenericId.GenericId("exerciseAttempts"),
              exerciseNumber: Schema.Number,
              isCorrect: Schema.Boolean,
              questionId: Schema.optional(
                GenericId.GenericId("exerciseQuestions")
              ),
              selectedOptionId: Schema.optional(Schema.String),
              textAnswer: Schema.optional(Schema.String),
              timeSpent: Schema.Number,
              updatedAt: Schema.Number,
            })
          ),
          attempt: Schema.Struct({
            _creationTime: Schema.Number,
            _id: GenericId.GenericId("exerciseAttempts"),
            answeredCount: Schema.Number,
            completedAt: Schema.Union(Schema.Number, Schema.Null),
            correctAnswers: Schema.Number,
            endReason: Schema.Union(
              Schema.Literal("submitted", "time-expired"),
              Schema.Null
            ),
            exerciseNumber: Schema.optional(Schema.Number),
            lastActivityAt: Schema.Number,
            mode: Schema.Literal("practice", "simulation"),
            origin: Schema.Literal("standalone", "tryout"),
            perQuestionTimeLimit: Schema.optional(Schema.Number),
            schedulerId: Schema.optional(
              GenericId.GenericId("_scheduled_functions")
            ),
            scope: Schema.Literal("set", "single"),
            scorePercentage: Schema.Number,
            slug: Schema.String,
            startedAt: Schema.Number,
            status: Schema.Literal("in-progress", "completed", "expired"),
            timeLimit: Schema.Number,
            totalExercises: Schema.Number,
            totalTime: Schema.Number,
            updatedAt: Schema.Number,
            userId: GenericId.GenericId("users"),
          }),
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
