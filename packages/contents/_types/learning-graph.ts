import {
  getSourceRouteProjection,
  getSourceRouteProjectionForRoute,
} from "@repo/contents/_types/graph/projection";
import { normalizeSourceRouteProjection } from "@repo/contents/_types/graph/route";
import {
  SourceRouteInputSchema,
  type SourceRouteProjection,
} from "@repo/contents/_types/graph/schema";
import { cleanSlug } from "@repo/utilities/helper";
import { Schema } from "effect";

/** Runtime schema for graph identity persisted as product identity. */
export const LearningGraphIdentitySchema = Schema.Struct({
  alignmentId: Schema.String,
  assetId: Schema.String,
  conceptId: Schema.String,
  learningObjectId: Schema.String,
  lensId: Schema.String,
});

/** Graph identity derived from the runtime schema. */
export type LearningGraphIdentity = Schema.Schema.Type<
  typeof LearningGraphIdentitySchema
>;

/** Runtime schema for source records that can be projected into graph identity. */
export const LearningGraphSourceSchema = SourceRouteInputSchema;

/** Learning graph source derived from the runtime schema. */
export type LearningGraphSource = Schema.Schema.Type<
  typeof LearningGraphSourceSchema
>;

/** Returns graph identity for a declared source route without throwing. */
export function getLearningGraphIdentity(source: LearningGraphSource) {
  const projection = getSourceRouteProjection(source);

  if (!projection) {
    return null;
  }

  return createLearningGraphIdentityFromProjection({
    locale: source.locale,
    projection,
  });
}

/** Creates graph identity from a public route projection when the kind is inferable. */
export function createLearningGraphIdentityFromRoute(
  source: Omit<LearningGraphSource, "kind">
) {
  const projection = getSourceRouteProjectionForRoute(
    source.route,
    source.locale
  );

  if (!projection) {
    return null;
  }

  return createLearningGraphIdentityFromProjection({
    locale: source.locale,
    projection,
  });
}

/** Normalizes one public route before graph identity derivation. */
export function normalizeGraphRoute(route: string) {
  return normalizeSourceRouteProjection(route);
}

/** Builds a stable graph ID from clean hierarchy segments. */
function buildGraphId(prefix: string, segments: readonly string[]) {
  const cleanSegments = segments.map(cleanGraphSegment).filter(Boolean);

  return `${prefix}:${cleanSegments.join(":")}`;
}

/** Builds stable graph IDs from a validated source-route projection. */
export function createLearningGraphIdentityFromProjection({
  locale,
  projection,
}: {
  readonly locale: LearningGraphSource["locale"];
  readonly projection: SourceRouteProjection;
}) {
  return {
    alignmentId: buildGraphId("alignment", [
      ...projection.lensSegments,
      ...projection.learningObjectSegments,
    ]),
    assetId: buildGraphId("asset", [
      locale,
      ...projection.lensSegments,
      ...projection.learningObjectSegments,
    ]),
    conceptId: buildGraphId("concept", projection.conceptSegments),
    learningObjectId: buildGraphId("lo", projection.learningObjectSegments),
    lensId: buildGraphId("lens", projection.lensSegments),
  };
}

/** Cleans one graph ID segment without treating route paths as identity. */
function cleanGraphSegment(segment: string) {
  return cleanSlug(segment).replaceAll("/", "-");
}
