import {
  createLearningGraphIdentity,
  getLearningGraphLensSegments,
  type LearningGraphSource,
  type LearningObjectKind,
  normalizeGraphRoute,
} from "@repo/contents/_types/learning-graph";

export type CurriculumLensScope =
  | "article-domain"
  | "curriculum"
  | "exam"
  | "scripture";

export interface CurriculumLensDescriptor {
  lensId: string;
  scope: CurriculumLensScope;
  segments: readonly string[];
  sourceRoute: string;
}

/**
 * Projects a source record into its graph lens.
 *
 * Lenses group localized assets by curriculum, exam, article domain, or other
 * learning scope without encoding country-specific assumptions in the core.
 */
export function createCurriculumLensDescriptor(
  source: LearningGraphSource
): CurriculumLensDescriptor {
  return {
    lensId: createLearningGraphIdentity(source).lensId,
    scope: getCurriculumLensScope(source.kind),
    segments: getLearningGraphLensSegments(source),
    sourceRoute: normalizeGraphRoute(source.route),
  };
}

/** Returns the broad product scope for one learning object kind. */
export function getCurriculumLensScope(
  kind: LearningObjectKind
): CurriculumLensScope {
  if (kind === "article") {
    return "article-domain";
  }

  if (kind === "quran-surah") {
    return "scripture";
  }

  if (kind.startsWith("exercise-")) {
    return "exam";
  }

  return "curriculum";
}
