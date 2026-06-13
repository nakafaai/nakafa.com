import {
  createLearningGraphIdentity,
  getLearningGraphLensSegments,
  type LearningGraphSource,
  type LearningObjectKind,
  normalizeGraphRoute,
} from "@repo/contents/_types/learning-graph";
import { Schema } from "effect";

/** Stable product scopes used to classify graph curriculum lenses. */
export const CURRICULUM_LENS_SCOPE_VALUES = [
  "article-domain",
  "curriculum",
  "exam",
  "scripture",
] as const;

/** Runtime schema for broad graph lens scopes. */
export const CurriculumLensScopeSchema = Schema.Literal(
  ...CURRICULUM_LENS_SCOPE_VALUES
);

/** Curriculum lens scope derived from the runtime schema. */
export type CurriculumLensScope = Schema.Schema.Type<
  typeof CurriculumLensScopeSchema
>;

/** Runtime schema for graph lens descriptors. */
export const CurriculumLensDescriptorSchema = Schema.Struct({
  lensId: Schema.String,
  scope: CurriculumLensScopeSchema,
  segments: Schema.Array(Schema.String),
  sourceRoute: Schema.String,
});

/** Curriculum lens descriptor derived from the runtime schema. */
export type CurriculumLensDescriptor = Schema.Schema.Type<
  typeof CurriculumLensDescriptorSchema
>;

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
