import { GenericId } from "@confect/core";
import { NAKAFA_CONTENT_SECTIONS } from "@repo/backend/confect/modules/content/constants";
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

export const articleCategorySchema = Schema.Literal("politics");

export type ArticleCategory = Schema.Schema.Type<typeof articleCategorySchema>;

export const subjectCategorySchema = Schema.Literal(
  "elementary-school",
  "middle-school",
  "high-school",
  "university"
);

export type SubjectCategory = Schema.Schema.Type<typeof subjectCategorySchema>;

export const gradeSchema = Schema.Literal(
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

export type Grade = Schema.Schema.Type<typeof gradeSchema>;

export const materialSchema = Schema.Literal(
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

export type Material = Schema.Schema.Type<typeof materialSchema>;

export const exercisesCategorySchema = Schema.Literal(
  "high-school",
  "middle-school"
);

export type ExercisesCategory = Schema.Schema.Type<
  typeof exercisesCategorySchema
>;

export const exercisesTypeSchema = Schema.Literal("grade-9", "tka", "snbt");

export type ExercisesType = Schema.Schema.Type<typeof exercisesTypeSchema>;

export const exercisesMaterialSchema = Schema.Literal(
  "mathematics",
  "quantitative-knowledge",
  "mathematical-reasoning",
  "general-reasoning",
  "indonesian-language",
  "english-language",
  "general-knowledge",
  "reading-and-writing-skills"
);

export type ExercisesMaterial = Schema.Schema.Type<
  typeof exercisesMaterialSchema
>;
