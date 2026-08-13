import type { ProgramNavigationLevel } from "@nakafa/aksara-contracts/program/spec";
import type { QuranSurahRow } from "@nakafa/aksara-contracts/quran/spec";
import type {
  Grade,
  PresentedMaterialDomain,
} from "@repo/contents/_types/taxonomy";

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
      type: "material-lesson";
      grade: Grade;
      material: PresentedMaterialDomain;
      chapter?: string;
      data: ContentSEOData;
    }
  | {
      type: "curriculum-context";
      level: ProgramNavigationLevel;
      parent?: string;
      program?: string;
      data: ContentSEOData;
    }
  | {
      type: "article";
      categoryLabel: string;
      data: ContentSEOData;
    }
  | {
      type: "quran";
      surah: QuranSurahRow;
    };

/**
 * Generated SEO metadata result
 * Note: Google does not use meta keywords for ranking, but this list is still
 * useful for internal search and content organization.
 */
export interface SEOMetadata {
  /** Meta description - 150-160 chars optimal */
  description: string;
  /** Keywords for internal search and content organization */
  keywords: string[];
  /** Page title - 50-60 chars optimal for Google display */
  title: string;
}
