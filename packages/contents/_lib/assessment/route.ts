import { ExercisesCategorySchema } from "@repo/contents/_types/assessment/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/assessment/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/assessment/type";
import type {
  ExercisesCategory,
  ExercisesMaterial,
  ExercisesType,
} from "@repo/contents/_types/taxonomy";
import { Schema } from "effect";

/**
 * Builds the public path for an exercises category page.
 *
 * @param category - Exercises category slug
 * @returns Canonical category path
 */
export function getCategoryPath(category: ExercisesCategory) {
  return `/assessment/${category}` as const;
}

/**
 * Builds the public path for an exercises type page.
 *
 * @param category - Exercises category slug
 * @param type - Exercises type slug
 * @returns Canonical type path
 */
export function getExercisesPath(
  category: ExercisesCategory,
  type: ExercisesType
) {
  return `/assessment/${category}/${type}` as const;
}

/**
 * Builds the public path for an exercises material page.
 *
 * @param category - Exercises category slug
 * @param type - Exercises type slug
 * @param material - Exercises material slug
 * @returns Canonical material path
 */
export function getMaterialPath(
  category: ExercisesCategory,
  type: ExercisesType,
  material: ExercisesMaterial
) {
  return `/assessment/${category}/${type}/${material}` as const;
}

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
