/**
 * Shared validators for content storage schema.
 * These match Zod schemas in packages/contents/_types/.
 */
import type { Infer } from "convex/values";
import { v } from "convex/values";

/** Supported content languages */
export const localeValidator = v.union(v.literal("en"), v.literal("id"));
export type Locale = Infer<typeof localeValidator>;

/** Discriminator for polymorphic content references (used in contentAuthors join table) */
export const contentTypeValidator = v.union(
  v.literal("article"),
  v.literal("subject"),
  v.literal("exercise")
);
export type ContentType = Infer<typeof contentTypeValidator>;

export const articleCategoryValidator = v.literal("politics");
export type ArticleCategory = Infer<typeof articleCategoryValidator>;

export const subjectCategoryValidator = v.union(
  v.literal("elementary-school"),
  v.literal("middle-school"),
  v.literal("high-school"),
  v.literal("university")
);
export type SubjectCategory = Infer<typeof subjectCategoryValidator>;

/** School grades (1-12) and university levels */
export const gradeValidator = v.union(
  v.literal("1"),
  v.literal("2"),
  v.literal("3"),
  v.literal("4"),
  v.literal("5"),
  v.literal("6"),
  v.literal("7"),
  v.literal("8"),
  v.literal("9"),
  v.literal("10"),
  v.literal("11"),
  v.literal("12"),
  v.literal("bachelor"),
  v.literal("master"),
  v.literal("phd")
);
export type Grade = Infer<typeof gradeValidator>;

/** Subject materials (high school + university) */
export const materialValidator = v.union(
  v.literal("mathematics"),
  v.literal("physics"),
  v.literal("chemistry"),
  v.literal("biology"),
  v.literal("geography"),
  v.literal("economy"),
  v.literal("history"),
  v.literal("informatics"),
  v.literal("geospatial"),
  v.literal("sociology"),
  v.literal("ai-ds"),
  v.literal("game-engineering"),
  v.literal("computer-science"),
  v.literal("technology-electro-medical"),
  v.literal("political-science"),
  v.literal("informatics-engineering"),
  v.literal("international-relations")
);
export type Material = Infer<typeof materialValidator>;

export const exercisesCategoryValidator = v.union(
  v.literal("high-school"),
  v.literal("middle-school")
);
export type ExercisesCategory = Infer<typeof exercisesCategoryValidator>;

/** Exam types: grade-9 (SMP), tka (old format), snbt (new format) */
export const exercisesTypeValidator = v.union(
  v.literal("grade-9"),
  v.literal("tka"),
  v.literal("snbt")
);
export type ExercisesType = Infer<typeof exercisesTypeValidator>;

/** Exercise-specific materials (differs from subject materials) */
export const exercisesMaterialValidator = v.union(
  v.literal("mathematics"),
  v.literal("quantitative-knowledge"),
  v.literal("mathematical-reasoning"),
  v.literal("general-reasoning"),
  v.literal("indonesian-language"),
  v.literal("english-language"),
  v.literal("general-knowledge"),
  v.literal("reading-and-writing-skills")
);
export type ExercisesMaterial = Infer<typeof exercisesMaterialValidator>;
