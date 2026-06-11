import { EXERCISES_MATERIALS } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

const ExercisesMaterialListItemSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  href: Schema.String,
  items: Schema.Array(
    Schema.Struct({
      title: Schema.String,
      href: Schema.String,
    }).pipe(Schema.mutable)
  ).pipe(Schema.mutable),
}).pipe(Schema.mutable);

export const ExercisesMaterialListSchema = Schema.Array(
  ExercisesMaterialListItemSchema
).pipe(Schema.mutable);
export type ExercisesMaterialList = Schema.Schema.Type<
  typeof ExercisesMaterialListSchema
>;

export const ExercisesMaterialSchema = Schema.Literal(...EXERCISES_MATERIALS);
