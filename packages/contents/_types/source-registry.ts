import { LocaleSchema } from "@repo/contents/_types/content";
import {
  createLearningGraphIdentity,
  getLearningObjectKindForRoute,
  LearningGraphIdentitySchema,
  type LearningObjectKind,
  LearningObjectKindSchema,
  normalizeGraphRoute,
} from "@repo/contents/_types/learning-graph";
import { cleanSlug } from "@repo/utilities/helper";
import { Schema } from "effect";

/** Stable source roots accepted by the graph source registry adapter. */
export const SOURCE_REGISTRY_ROOT_VALUES = [
  "articles",
  "exercises",
  "quran",
  "subject",
] as const;

/** Runtime schema for graph source registry roots. */
export const SourceRegistryRootSchema = Schema.Literal(
  ...SOURCE_REGISTRY_ROOT_VALUES
);

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
  const kind = getLearningObjectKindForRoute(publicRoute);

  if (!kind) {
    return null;
  }

  return {
    ...createLearningGraphIdentity({
      kind,
      locale: input.locale,
      route: publicRoute,
    }),
    kind,
    locale: input.locale,
    publicRoute,
    sourcePath: normalizeSourcePath(input.sourcePath),
    sourceRoot: getSourceRoot(kind),
  };
}

/** Normalizes a source-path provenance string without turning it into identity. */
export function normalizeSourcePath(sourcePath: string) {
  return cleanSlug(sourcePath).split("/").filter(Boolean).join("/");
}

function getSourceRoot(kind: LearningObjectKind): SourceRegistryRoot {
  if (kind === "article") {
    return "articles";
  }

  if (kind === "quran-surah") {
    return "quran";
  }

  if (kind.startsWith("exercise-")) {
    return "exercises";
  }

  return "subject";
}
