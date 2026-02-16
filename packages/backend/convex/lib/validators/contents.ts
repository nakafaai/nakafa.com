import type { Infer } from "convex/values";
import { v } from "convex/values";
import { literals } from "convex-helpers/validators";

/** Supported content languages */
export const localeValidator = literals("en", "id");
export type Locale = Infer<typeof localeValidator>;

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

export const articleCategoryValidator = literals("politics");
export type ArticleCategory = Infer<typeof articleCategoryValidator>;

export const subjectCategoryValidator = literals(
  "elementary-school",
  "middle-school",
  "high-school",
  "university"
);
export type SubjectCategory = Infer<typeof subjectCategoryValidator>;

export const gradeValidator = literals(
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
  "bachelor",
  "master",
  "phd"
);
export type Grade = Infer<typeof gradeValidator>;

export const materialValidator = literals(
  "mathematics",
  "physics",
  "chemistry",
  "biology",
  "geography",
  "economy",
  "history",
  "informatics",
  "geospatial",
  "sociology",
  "ai-ds",
  "game-engineering",
  "computer-science",
  "technology-electro-medical",
  "political-science",
  "informatics-engineering",
  "international-relations"
);
export type Material = Infer<typeof materialValidator>;

export const exercisesCategoryValidator = literals(
  "high-school",
  "middle-school"
);
export type ExercisesCategory = Infer<typeof exercisesCategoryValidator>;

export const exercisesTypeValidator = literals("grade-9", "tka", "snbt");
export type ExercisesType = Infer<typeof exercisesTypeValidator>;

export const exercisesMaterialValidator = literals(
  "mathematics",
  "quantitative-knowledge",
  "mathematical-reasoning",
  "general-reasoning",
  "indonesian-language",
  "english-language",
  "general-knowledge",
  "reading-and-writing-skills"
);
export type ExercisesMaterial = Infer<typeof exercisesMaterialValidator>;
