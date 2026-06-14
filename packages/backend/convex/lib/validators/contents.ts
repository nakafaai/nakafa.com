import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/convex/contents/constants";
import {
  ARTICLE_CATEGORIES,
  EXERCISES_CATEGORIES,
  EXERCISES_MATERIALS,
  EXERCISES_TYPES,
  GRADES,
  SUBJECT_CATEGORIES,
  SUBJECT_MATERIALS,
} from "@repo/contents/_types/taxonomy";
import { locales } from "@repo/utilities/locales";
import type { Infer } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Supported content languages for Convex validators. */
export const SUPPORTED_CONTENT_LOCALES = locales;
export const localeValidator = literals(...SUPPORTED_CONTENT_LOCALES);
export type Locale = Infer<typeof localeValidator>;

/** Public Nakafa content sections exposed to agents and search. */
export const nakafaSectionValidator = literals(...NAKAFA_CONTENT_SECTIONS);
export type NakafaSection = Infer<typeof nakafaSectionValidator>;

/** Content families used by source-shaped runtime tables and analytics events. */
export const CONTENT_TYPE_VALUES = ["article", "subject", "exercise"] as const;
export const contentTypeValidator = literals(...CONTENT_TYPE_VALUES);
export type ContentType = Infer<typeof contentTypeValidator>;

export const articleCategoryValidator = literals(...ARTICLE_CATEGORIES);
export type ArticleCategory = Infer<typeof articleCategoryValidator>;

export const subjectCategoryValidator = literals(...SUBJECT_CATEGORIES);
export type SubjectCategory = Infer<typeof subjectCategoryValidator>;

export const gradeValidator = literals(...GRADES);
export type Grade = Infer<typeof gradeValidator>;

export const materialValidator = literals(...SUBJECT_MATERIALS);
export type Material = Infer<typeof materialValidator>;

export const exercisesCategoryValidator = literals(...EXERCISES_CATEGORIES);
export type ExercisesCategory = Infer<typeof exercisesCategoryValidator>;

export const exercisesTypeValidator = literals(...EXERCISES_TYPES);
export type ExercisesType = Infer<typeof exercisesTypeValidator>;

export const exercisesMaterialValidator = literals(...EXERCISES_MATERIALS);
export type ExercisesMaterial = Infer<typeof exercisesMaterialValidator>;
