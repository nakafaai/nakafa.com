import { Table } from "@confect/server";
import {
  exercisesCategorySchema,
  exercisesMaterialSchema,
  exercisesTypeSchema,
  localeSchema,
} from "@repo/backend/confect/modules/content/content.schemas";
import { Schema } from "effect";

/** exerciseSets table definition. */
export const ExerciseSets = Table.make(
  "exerciseSets",
  Schema.Struct({
    locale: localeSchema,
    slug: Schema.String,
    category: exercisesCategorySchema,
    type: exercisesTypeSchema,
    material: exercisesMaterialSchema,
    exerciseType: Schema.String,
    setName: Schema.String,
    title: Schema.String,
    description: Schema.optional(Schema.String),
    questionCount: Schema.Number,
    syncedAt: Schema.Number,
  })
)
  .index("by_syncedAt", ["syncedAt"])
  .index("by_locale_and_slug", ["locale", "slug"])
  .index("by_locale_and_type_and_exerciseType", [
    "locale",
    "type",
    "exerciseType",
  ]);

export const tables = [ExerciseSets] as const;
