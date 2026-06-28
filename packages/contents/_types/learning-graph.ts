import { LocaleSchema } from "@repo/contents/_types/content";
import {
  getSourceRouteProjection,
  getSourceRouteProjectionForRoute,
  parseSourceRouteProjection,
} from "@repo/contents/_types/graph/projection";
import { normalizeSourceRouteProjection } from "@repo/contents/_types/graph/route";
import {
  InvalidLearningGraphRouteError,
  LearningObjectKindSchema,
  type SourceRouteProjection,
} from "@repo/contents/_types/graph/schema";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Schema } from "effect";

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

/** Decodes and parses graph identity with a typed graph route failure. */
export const parseLearningGraphIdentity = Effect.fn(
  "contents.graph.parseLearningGraphIdentity"
)(function* (input: unknown) {
  const source = yield* Schema.decodeUnknown(LearningGraphSourceSchema)(
    input
  ).pipe(Effect.mapError(() => createInvalidLearningGraphSourceError(input)));
  const projection = yield* parseSourceRouteProjection(source);

  return createLearningGraphIdentityFromProjection({
    locale: source.locale,
    projection,
  });
});

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

/** Returns the stable lens hierarchy for a declared source route without throwing. */
export function getLearningGraphLensSegments(source: LearningGraphSource) {
  return getSourceRouteProjection(source)?.lensSegments ?? null;
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

/** Builds a graph route error when identity source decoding fails. */
function createInvalidLearningGraphSourceError(input: unknown) {
  const route = readUnknownRoute(input) ?? "";

  return new InvalidLearningGraphRouteError({
    message: route
      ? `Invalid learning graph source input "${normalizeSourceRouteProjection(route)}".`
      : "Invalid learning graph source input.",
    route: normalizeSourceRouteProjection(route),
  });
}

/** Reads the route field from an unknown source payload without a cast. */
function readUnknownRoute(input: unknown) {
  if (!(typeof input === "object" && input !== null && "route" in input)) {
    return;
  }

  const { route } = input;

  return typeof route === "string" ? route : undefined;
}
