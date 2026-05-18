import { Schema } from "effect";

export const EXERCISES_TYPES = ["grade-9", "tka", "snbt"] as const;

export const ExercisesTypeSchema = Schema.Literal(...EXERCISES_TYPES);
export type ExercisesType = Schema.Schema.Type<typeof ExercisesTypeSchema>;
