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

export interface ExerciseChoicesByLocale {
  en: Array<{ label: string; value: boolean }>;
  id: Array<{ label: string; value: boolean }>;
}
