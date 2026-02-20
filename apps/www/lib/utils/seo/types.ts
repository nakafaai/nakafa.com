import type { ArticleCategory } from "@repo/contents/_types/articles/category";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import type { Surah } from "@repo/contents/_types/quran";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type { Material } from "@repo/contents/_types/subject/material";

/**
 * Base SEO data extracted from content metadata
 * Evidence: Google recommends unique titles/descriptions per page
 * Source: https://developers.google.com/search/docs/appearance/title-link
 */
export interface ContentSEOData {
  /** Content description for meta description */
  description?: string;
  /** Subject name - used as fallback in getEffectiveTitle() */
  subject?: string;
  /** Content title - primary keyword source (undefined = use fallback chain) */
  title?: string;
}

/**
 * Strict discriminated union for different content types
 * Uses actual Zod schemas from @repo/contents/_types for type safety
 * No raw strings - all values are validated at compile time
 */
export type SEOContext =
  | {
      type: "subject";
      category: SubjectCategory;
      grade: Grade;
      material: Material;
      chapter?: string;
      data: ContentSEOData;
    }
  | {
      type: "exercise";
      category: ExercisesCategory;
      exam: ExercisesType;
      material: ExercisesMaterial;
      group?: string; // Exercise group name (e.g., "Try Out")
      set?: string; // Exercise set name (e.g., "Set 1")
      number?: number; // Exercise number for specific questions (e.g., 1, 2, 3)
      questionCount?: number;
      data: ContentSEOData;
    }
  | {
      type: "article";
      category: ArticleCategory;
      data: ContentSEOData;
    }
  | {
      type: "quran";
      surah: Surah;
    };

/**
 * Generated SEO metadata result
 * Evidence: Keywords help Google understand page content
 * Source: https://developers.google.com/search/docs/appearance/snippet
 * Note: While Google doesn't use meta keywords for ranking, they help
 * with internal search and content organization
 */
export interface SEOMetadata {
  /** Meta description - 150-160 chars optimal */
  description: string;
  /** Keywords for internal search and content organization */
  keywords: string[];
  /** Page title - 50-60 chars optimal for Google display */
  title: string;
}
