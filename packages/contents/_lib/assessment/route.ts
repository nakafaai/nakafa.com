import { ExercisesCategorySchema } from "@repo/contents/_types/assessment/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/assessment/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/assessment/type";
import { Schema } from "effect";

/** Narrows one exercises category route segment to the supported category union. */
export function parseExercisesCategory(value: string) {
  return Schema.decodeUnknownOption(ExercisesCategorySchema)(value);
}

/** Narrows one exercises type route segment to the supported type union. */
export function parseExercisesType(value: string) {
  return Schema.decodeUnknownOption(ExercisesTypeSchema)(value);
}

/** Narrows one exercises material route segment to the supported material union. */
export function parseExercisesMaterial(value: string) {
  return Schema.decodeUnknownOption(ExercisesMaterialSchema)(value);
}
