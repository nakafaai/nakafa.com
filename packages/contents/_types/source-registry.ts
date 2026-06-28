import { LocaleSchema } from "@repo/contents/_types/content";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import {
  LearningObjectKindSchema,
  SourceRegistryRootSchema,
} from "@repo/contents/_types/graph/schema";
import {
  createLearningGraphIdentityFromProjection,
  LearningGraphIdentitySchema,
  normalizeGraphRoute,
} from "@repo/contents/_types/learning-graph";
import { cleanSlug } from "@repo/utilities/helper";
import { Schema } from "effect";

/** Source registry root derived from the runtime schema. */
export type SourceRegistryRoot = Schema.Schema.Type<
  typeof SourceRegistryRootSchema
>;

/** Runtime schema for current corpus source records before graph projection. */
export const SourceRegistryInputSchema = Schema.Struct({
  locale: LocaleSchema,
  route: Schema.String,
  sourcePath: Schema.String,
});

/** Source registry input derived from the runtime schema. */
export type SourceRegistryInput = Schema.Schema.Type<
  typeof SourceRegistryInputSchema
>;

/** Runtime schema for graph-backed source registry records. */
export const SourceRegistryRecordSchema = LearningGraphIdentitySchema.pipe(
  Schema.extend(
    Schema.Struct({
      kind: LearningObjectKindSchema,
      locale: LocaleSchema,
      publicRoute: Schema.String,
      sourcePath: Schema.String,
      sourceRoot: SourceRegistryRootSchema,
    })
  )
);

/** Source registry record derived from the runtime schema. */
export type SourceRegistryRecord = Schema.Schema.Type<
  typeof SourceRegistryRecordSchema
>;

/**
 * Adapts one current corpus route into a graph-backed source registry record.
 *
 * `sourcePath` is provenance only. Consumers persist the graph identity fields
 * as product identity and keep `publicRoute` as a route projection.
 */
export function createSourceRegistryRecord(
  input: SourceRegistryInput
): SourceRegistryRecord | null {
  const publicRoute = normalizeGraphRoute(input.route);
  const projection = getSourceRouteProjectionForRoute(publicRoute);

  if (!projection) {
    return null;
  }

  return {
    ...createLearningGraphIdentityFromProjection({
      locale: input.locale,
      projection,
    }),
    kind: projection.kind,
    locale: input.locale,
    publicRoute,
    sourcePath: normalizeSourcePath(input.sourcePath),
    sourceRoot: projection.sourceRoot,
  };
}

/** Normalizes a source-path provenance string without turning it into identity. */
export function normalizeSourcePath(sourcePath: string) {
  return cleanSlug(sourcePath).split("/").filter(Boolean).join("/");
}
