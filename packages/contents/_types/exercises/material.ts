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

export const EXERCISES_MATERIALS = [
  "mathematics",
  "quantitative-knowledge",
  "mathematical-reasoning",
  "general-reasoning",
  "indonesian-language",
  "english-language",
  "general-knowledge",
  "reading-and-writing-skills",
] as const;

export const ExercisesMaterialSchema = Schema.Literal(...EXERCISES_MATERIALS);
export type ExercisesMaterial = Schema.Schema.Type<
  typeof ExercisesMaterialSchema
>;
