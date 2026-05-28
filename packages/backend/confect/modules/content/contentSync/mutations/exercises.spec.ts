import { FunctionSpec, GenericId, GroupSpec } from "@confect/core";
import {
  exercisesCategorySchema,
  exercisesMaterialSchema,
  exercisesTypeSchema,
  localeSchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

const contentSyncMutationsExercisesGroup = GroupSpec.make("exercises")
  .addFunction(
    FunctionSpec.internalMutation({
      name: "bulkSyncExerciseQuestions",
      args: Schema.Struct({
        questions: Schema.Array(
          Schema.Struct({
            answerBody: Schema.String,
            authors: Schema.Array(Schema.Struct({ name: Schema.String })),
            category: exercisesCategorySchema,
            choices: Schema.Array(
              Schema.Struct({
                isCorrect: Schema.Boolean,
                label: Schema.String,
                optionKey: Schema.String,
                order: Schema.Number,
              })
            ),
            contentHash: Schema.String,
            date: Schema.Number,
            description: Schema.optional(Schema.String),
            exerciseType: Schema.String,
            locale: localeSchema,
            material: exercisesMaterialSchema,
            number: Schema.Number,
            questionBody: Schema.String,
            searchDescription: Schema.String,
            searchText: Schema.String,
            searchTitle: Schema.String,
            setName: Schema.String,
            setSlug: Schema.String,
            slug: Schema.String,
            title: Schema.String,
            type: exercisesTypeSchema,
          })
        ),
      }),
      returns: Schema.Struct({
        authorLinksCreated: Schema.Number,
        choicesCreated: Schema.Number,
        created: Schema.Number,
        skipped: Schema.Number,
        skippedSetSlugs: Schema.Array(Schema.String),
        unchanged: Schema.Number,
        updated: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "bulkSyncExerciseSets",
      args: Schema.Struct({
        sets: Schema.Array(
          Schema.Struct({
            category: exercisesCategorySchema,
            contentHash: Schema.String,
            description: Schema.optional(Schema.String),
            exerciseType: Schema.String,
            locale: localeSchema,
            material: exercisesMaterialSchema,
            questionCount: Schema.Number,
            searchDescription: Schema.String,
            searchText: Schema.String,
            searchTitle: Schema.String,
            setName: Schema.String,
            slug: Schema.String,
            title: Schema.String,
            type: exercisesTypeSchema,
          })
        ),
      }),
      returns: Schema.Struct({
        created: Schema.Number,
        unchanged: Schema.Number,
        updated: Schema.Number,
      }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteStaleExerciseQuestions",
      args: Schema.Struct({
        questionIds: Schema.Array(GenericId.GenericId("exerciseQuestions")),
      }),
      returns: Schema.Struct({ deleted: Schema.Number }),
    })
  )
  .addFunction(
    FunctionSpec.internalMutation({
      name: "deleteStaleExerciseSets",
      args: Schema.Struct({
        setIds: Schema.Array(GenericId.GenericId("exerciseSets")),
      }),
      returns: Schema.Struct({ deleted: Schema.Number }),
    })
  );

export { contentSyncMutationsExercisesGroup };
