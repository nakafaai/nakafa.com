import {
  CurriculumLensScopeSchema,
  getCurriculumLensScopeForKind,
  type LearningObjectKind,
} from "@repo/contents/_types/graph/schema";
import {
  getLearningGraphIdentity,
  getLearningGraphLensSegments,
  type LearningGraphSource,
  normalizeGraphRoute,
} from "@repo/contents/_types/learning-graph";
import { Schema } from "effect";

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
): CurriculumLensDescriptor | null {
  const identity = getLearningGraphIdentity(source);
  const segments = getLearningGraphLensSegments(source);

  if (!(identity && segments)) {
    return null;
  }

  return {
    lensId: identity.lensId,
    scope: getCurriculumLensScope(source.kind),
    segments,
    sourceRoute: normalizeGraphRoute(source.route),
  };
}

/** Returns the broad product scope for one learning object kind. */
export function getCurriculumLensScope(
  kind: LearningObjectKind
): CurriculumLensScope {
  return getCurriculumLensScopeForKind(kind);
}
