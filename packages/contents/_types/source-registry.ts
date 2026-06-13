import type { Locale } from "@repo/contents/_types/content";
import {
  createLearningGraphIdentity,
  getLearningObjectKindForRoute,
  type LearningGraphIdentity,
  type LearningObjectKind,
  normalizeGraphRoute,
} from "@repo/contents/_types/learning-graph";
import { cleanSlug } from "@repo/utilities/helper";

export type SourceRegistryRoot = "articles" | "exercises" | "quran" | "subject";

export interface SourceRegistryInput {
  locale: Locale;
  route: string;
  sourcePath: string;
}

export interface SourceRegistryRecord extends LearningGraphIdentity {
  kind: LearningObjectKind;
  locale: Locale;
  publicRoute: string;
  sourcePath: string;
  sourceRoot: SourceRegistryRoot;
}

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
