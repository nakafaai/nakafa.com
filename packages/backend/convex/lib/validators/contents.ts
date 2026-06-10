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
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Supported content languages for Convex validators. */
export const SUPPORTED_CONTENT_LOCALES = locales;
export const localeValidator = literals(...SUPPORTED_CONTENT_LOCALES);
export type Locale = Infer<typeof localeValidator>;

/** Public Nakafa content sections exposed to agents and search. */
export const nakafaSectionValidator = literals(...NAKAFA_CONTENT_SECTIONS);
export type NakafaSection = Infer<typeof nakafaSectionValidator>;

/** Content types for view tracking and popularity */
export const contentTypeValidator = literals("article", "subject", "exercise");
export type ContentType = Infer<typeof contentTypeValidator>;

/**
 * Discriminated union for content references.
 * Used in views and popularity tables.
 */
export const contentRefValidator = v.union(
  v.object({
    type: v.literal("article"),
    id: v.id("articleContents"),
  }),
  v.object({
    type: v.literal("subject"),
    id: v.id("subjectSections"),
  }),
  v.object({
    type: v.literal("exercise"),
    id: v.id("exerciseSets"),
  })
);

export type ContentRef = Infer<typeof contentRefValidator>;

/**
 * Content reference with slug for view tracking.
 */
export const contentViewRefValidator = v.union(
  v.object({
    type: v.literal("article"),
    slug: v.string(),
  }),
  v.object({
    type: v.literal("subject"),
    slug: v.string(),
  }),
  v.object({
    type: v.literal("exercise"),
    slug: v.string(),
  })
);

export type ContentViewRef = Infer<typeof contentViewRefValidator>;

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
