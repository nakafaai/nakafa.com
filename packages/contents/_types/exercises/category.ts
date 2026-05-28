import { Schema } from "effect";

export const HIGH_SCHOOL_EXERCISES_CATEGORY = "high-school";
export const MIDDLE_SCHOOL_EXERCISES_CATEGORY = "middle-school";

export const EXERCISES_CATEGORIES = [
  HIGH_SCHOOL_EXERCISES_CATEGORY,
  MIDDLE_SCHOOL_EXERCISES_CATEGORY,
] as const;

export const ExercisesCategorySchema = Schema.Literal(...EXERCISES_CATEGORIES);
export type ExercisesCategory = Schema.Schema.Type<
  typeof ExercisesCategorySchema
>;
