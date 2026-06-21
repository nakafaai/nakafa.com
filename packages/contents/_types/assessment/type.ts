import { EXERCISES_TYPES } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

export const ExercisesTypeSchema = Schema.Literal(...EXERCISES_TYPES);
