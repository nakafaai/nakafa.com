import { EXERCISES_CATEGORIES } from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

export const ExercisesCategorySchema = Schema.Literal(...EXERCISES_CATEGORIES);
