import type { Locale } from "@repo/backend/convex/lib/validators/contents";
import type { ContentMetadata } from "@repo/contents/_types/content";
import type {
  ArticleCategory,
  ExercisesCategory,
  ExercisesMaterial,
  ExercisesType,
  Grade,
  Material,
  SubjectCategory,
} from "@repo/contents/_types/taxonomy";

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
  locale: Locale;
  slug: string;
  type: "article";
}

/** Parsed path info for subject files: subject/{category}/{grade}/{material}/{topic}/{section}/{locale}.mdx. */
export interface SubjectParsedPath {
  category: SubjectCategory;
  grade: Grade;
  locale: Locale;
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
  locale: Locale;
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
  exerciseTypeTitle: string;
  locale: Locale;
  material: ExercisesMaterial;
  setName: string;
  slug: string;
  title: string;
  type: ExercisesType;
  year?: number;
}

/** Parsed subject section order from a material file topic item. */
export interface ParsedSubjectSection {
  order: number;
  section: string;
  slug: string;
}

/** Parsed subject topic from material file. */
export interface ParsedSubjectTopic {
  category: SubjectCategory;
  description?: string;
  grade: Grade;
  locale: Locale;
  material: Material;
  order: number;
  sections: ParsedSubjectSection[];
  slug: string;
  title: string;
  topic: string;
}

export interface ExerciseChoicesByLocale {
  en: Array<{ label: string; value: boolean }>;
  id: Array<{ label: string; value: boolean }>;
}
