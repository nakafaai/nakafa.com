import type { Locale as ParsedLocale } from "@repo/backend/convex/lib/validators/contents";
import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import type { ContentMetadata } from "@repo/contents/_types/content";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";

/** Parsed MDX file with extracted metadata and content hash for change detection. */
export interface ParsedMdx {
  body: string;
  contentHash: string;
  metadata: ContentMetadata;
}

/** Parsed path info for article files: articles/{category}/{articleSlug}/{locale}.mdx. */
export interface ArticleParsedPath {
  articleSlug: string;
  category: ArticleCategory;
  locale: ParsedLocale;
  slug: string;
  type: "article";
}

/** Parsed path info for subject files: subject/{category}/{grade}/{material}/{topic}/{section}/{locale}.mdx. */
export interface SubjectParsedPath {
  category: SubjectCategory;
  grade: Grade;
  locale: ParsedLocale;
  material: Material;
  section: string;
  slug: string;
  topic: string;
  type: "subject";
}

/** Parsed path info for exercise files. */
export interface ExerciseParsedPath {
  category: ExercisesCategory;
  examType: ExercisesType;
  exerciseType: string;
  isQuestion: boolean;
  locale: ParsedLocale;
  material: ExercisesMaterial;
  number: number;
  setName: string;
  slug: string;
  type: "exercise";
  year?: number;
}

/** Parsed exercise set from material file. */
export interface ParsedExerciseSet {
  category: ExercisesCategory;
  description?: string;
  exerciseType: string;
  locale: ParsedLocale;
  material: ExercisesMaterial;
  setName: string;
  slug: string;
  title: string;
  type: ExercisesType;
  year?: number;
}

/** Parsed subject topic from material file. */
export interface ParsedSubjectTopic {
  category: SubjectCategory;
  description?: string;
  grade: Grade;
  locale: ParsedLocale;
  material: Material;
  sectionCount: number;
  slug: string;
  title: string;
  topic: string;
}

export interface ExerciseChoicesByLocale {
  en: Array<{ label: string; value: boolean }>;
  id: Array<{ label: string; value: boolean }>;
}
