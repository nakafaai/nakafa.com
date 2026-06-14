import { LocaleSchema } from "@repo/contents/_types/content";
import {
  getSourceRouteProjectionForRoute,
  LearningObjectKindSchema,
  normalizeSourceRouteProjection,
  requireSourceRouteProjection,
} from "@repo/contents/_types/graph/spec";
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
export const LearningGraphSourceSchema = Schema.Struct({
  kind: LearningObjectKindSchema,
  locale: LocaleSchema,
  route: Schema.String,
});

/** Learning graph source derived from the runtime schema. */
export type LearningGraphSource = Schema.Schema.Type<
  typeof LearningGraphSourceSchema
>;

/**
 * Creates graph identity for one source-registry record.
 *
 * The adapter accepts today's source route as input, but callers persist graph
 * IDs as product identity. Public routes remain projections of this record.
 */
export function createLearningGraphIdentity(
  source: LearningGraphSource
): LearningGraphIdentity {
  const projection = requireSourceRouteProjection(source);

  return createLearningGraphIdentityFromProjection({
    locale: source.locale,
    projection,
  });
}

/** Creates graph identity from a public route projection when the kind is inferable. */
export function createLearningGraphIdentityFromRoute(
  source: Omit<LearningGraphSource, "kind">
) {
  const projection = getSourceRouteProjectionForRoute(source.route);

  if (!projection) {
    return null;
  }

  return createLearningGraphIdentityFromProjection({
    locale: source.locale,
    projection,
  });
}

/** Returns the stable lens hierarchy used by graph identity generation. */
export function getLearningGraphLensSegments(
  source: LearningGraphSource
): readonly string[] {
  return requireSourceRouteProjection(source).lensSegments;
}

/** Normalizes one public route before graph identity derivation. */
export function normalizeGraphRoute(route: string) {
  return normalizeSourceRouteProjection(route);
}

/** Builds a stable graph ID from clean hierarchy segments. */
export function buildGraphId(prefix: string, segments: readonly string[]) {
  const cleanSegments = segments.map(cleanGraphSegment).filter(Boolean);

  if (cleanSegments.length === 0) {
    return prefix;
  }

  return `${prefix}:${cleanSegments.join(":")}`;
}

/** Infers the graph object kind represented by one canonical public route. */
export function getLearningObjectKindForRoute(route: string) {
  return getSourceRouteProjectionForRoute(route)?.kind ?? null;
}

function createLearningGraphIdentityFromProjection({
  locale,
  projection,
}: {
  readonly locale: LearningGraphSource["locale"];
  readonly projection: NonNullable<
    ReturnType<typeof getSourceRouteProjectionForRoute>
  >;
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

function cleanGraphSegment(segment: string) {
  return cleanSlug(segment).replaceAll("/", "-");
}
