import { GenericId } from "@confect/core";
import { Table } from "@confect/server";
import {
  exercisesCategorySchema,
  exercisesMaterialSchema,
  exercisesTypeSchema,
  localeSchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

/** exerciseQuestions table definition. */
export const ExerciseQuestions = Table.make(
  "exerciseQuestions",
  Schema.Struct({
    setId: GenericId.GenericId("exerciseSets"),
    locale: localeSchema,
    slug: Schema.String,
    category: exercisesCategorySchema,
    type: exercisesTypeSchema,
    material: exercisesMaterialSchema,
    exerciseType: Schema.String,
    setName: Schema.String,
    number: Schema.Number,
    title: Schema.String,
    description: Schema.optional(Schema.String),
    date: Schema.Number,
    questionBody: Schema.String,
    answerBody: Schema.String,
    contentHash: Schema.String,
    syncedAt: Schema.Number,
  })
)
  .index("by_locale_and_slug", ["locale", "slug"])
  .index("by_setId", ["setId"]);

/** exerciseChoices table definition. */
export const ExerciseChoices = Table.make(
  "exerciseChoices",
  Schema.Struct({
    questionId: GenericId.GenericId("exerciseQuestions"),
    locale: localeSchema,
    optionKey: Schema.String,
    label: Schema.String,
    isCorrect: Schema.Boolean,
    order: Schema.Number,
  })
).index("by_questionId_and_locale", ["questionId", "locale"]);

export const tables = [ExerciseQuestions, ExerciseChoices] as const;
