import { GenericId } from "@confect/core";
import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/confect/modules/content/constants";
import { ArticleCategorySchema } from "@repo/contents/_types/articles/category";
import { ExercisesCategorySchema } from "@repo/contents/_types/exercises/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/exercises/type";
import { SubjectCategorySchema } from "@repo/contents/_types/subject/category";
import { GradeSchema } from "@repo/contents/_types/subject/grade";
import { MaterialSchema } from "@repo/contents/_types/subject/material";
import { locales } from "@repo/utilities/locales";
import { Schema } from "effect";

export const SUPPORTED_CONTENT_LOCALES = locales;

export const localeSchema = Schema.Literal(...SUPPORTED_CONTENT_LOCALES);

export type Locale = Schema.Schema.Type<typeof localeSchema>;

/** Public Nakafa content sections exposed to agents and search. */
export const nakafaSectionSchema = Schema.Literal(...NAKAFA_CONTENT_SECTIONS);

export type NakafaSection = Schema.Schema.Type<typeof nakafaSectionSchema>;

/** Content types for view tracking and popularity */
export const contentTypeSchema = Schema.Literal(
  "article",
  "subject",
  "exercise"
);

export type ContentType = Schema.Schema.Type<typeof contentTypeSchema>;

/**
 * Discriminated union for content references.
 * Used in views and popularity tables.
 */
export const contentRefSchema = Schema.Union(
  Schema.Struct({
    type: Schema.Literal("article"),
    id: GenericId.GenericId("articleContents"),
  }),
  Schema.Struct({
    type: Schema.Literal("subject"),
    id: GenericId.GenericId("subjectSections"),
  }),
  Schema.Struct({
    type: Schema.Literal("exercise"),
    id: GenericId.GenericId("exerciseSets"),
  })
);

export type ContentRef = Schema.Schema.Type<typeof contentRefSchema>;

/**
 * Content reference with slug for view tracking.
 */
export const contentViewRefSchema = Schema.Union(
  Schema.Struct({ type: Schema.Literal("article"), slug: Schema.String }),
  Schema.Struct({ type: Schema.Literal("subject"), slug: Schema.String }),
  Schema.Struct({ type: Schema.Literal("exercise"), slug: Schema.String })
);

export type ContentViewRef = Schema.Schema.Type<typeof contentViewRefSchema>;

export const articleCategorySchema = ArticleCategorySchema;

export type ArticleCategory = Schema.Schema.Type<typeof articleCategorySchema>;

export const subjectCategorySchema = SubjectCategorySchema;

export type SubjectCategory = Schema.Schema.Type<typeof subjectCategorySchema>;

export const gradeSchema = GradeSchema;

export type Grade = Schema.Schema.Type<typeof gradeSchema>;

export const materialSchema = MaterialSchema;

export type Material = Schema.Schema.Type<typeof materialSchema>;

export const exercisesCategorySchema = ExercisesCategorySchema;

export type ExercisesCategory = Schema.Schema.Type<
  typeof exercisesCategorySchema
>;

export const exercisesTypeSchema = ExercisesTypeSchema;

export type ExercisesType = Schema.Schema.Type<typeof exercisesTypeSchema>;

export const exercisesMaterialSchema = ExercisesMaterialSchema;

export type ExercisesMaterial = Schema.Schema.Type<
  typeof exercisesMaterialSchema
>;
