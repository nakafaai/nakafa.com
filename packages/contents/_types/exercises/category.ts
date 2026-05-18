import { Schema } from "effect";

export const EXERCISES_CATEGORIES = ["high-school", "middle-school"] as const;

export const ExercisesCategorySchema = Schema.Literal(...EXERCISES_CATEGORIES);
export type ExercisesCategory = Schema.Schema.Type<
  typeof ExercisesCategorySchema
>;
