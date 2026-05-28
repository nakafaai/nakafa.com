import { Schema } from "effect";

export const GRADE_9_EXERCISES_TYPE = "grade-9";
export const TKA_EXERCISES_TYPE = "tka";
export const SNBT_EXERCISES_TYPE = "snbt";

export const EXERCISES_TYPES = [
  GRADE_9_EXERCISES_TYPE,
  TKA_EXERCISES_TYPE,
  SNBT_EXERCISES_TYPE,
] as const;

export const ExercisesTypeSchema = Schema.Literal(...EXERCISES_TYPES);
export type ExercisesType = Schema.Schema.Type<typeof ExercisesTypeSchema>;
