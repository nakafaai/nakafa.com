import type { Locale } from "@repo/contents/_types/content";
import { cleanSlug } from "@repo/utilities/helper";

export type LearningObjectKind =
  | "article"
  | "subject-topic"
  | "subject-section"
  | "exercise-group"
  | "exercise-set"
  | "exercise-question"
  | "quran-surah";

export interface LearningGraphIdentity {
  alignmentId: string;
  assetId: string;
  conceptId: string;
  learningObjectId: string;
  lensId: string;
}

export interface LearningGraphSource {
  kind: LearningObjectKind;
  locale: Locale;
  route: string;
}

const KIND_ROUTE_LENGTHS = {
  article: [3],
  "exercise-group": [5, 6],
  "exercise-question": [7, 8],
  "exercise-set": [6, 7],
  "quran-surah": [2],
  "subject-section": [6],
  "subject-topic": [5],
} as const satisfies Record<LearningObjectKind, readonly number[]>;

/**
 * Creates graph identity for one source-registry record.
 *
 * The adapter accepts today's source route as input, but callers persist graph
 * IDs as product identity. Public routes remain projections of this record.
 */
export function createLearningGraphIdentity(
  source: LearningGraphSource
): LearningGraphIdentity {
  const route = normalizeGraphRoute(source.route);
  const parts = route.split("/");

  assertRouteShape(source.kind, route, parts);

  const lens = getLensSegments(source.kind, parts);
  const concept = getConceptSegments(source.kind, parts);
  const learningObject = getLearningObjectSegments(source.kind, parts);

  return {
    alignmentId: buildGraphId("alignment", [...lens, ...learningObject]),
    assetId: buildGraphId("asset", [source.locale, ...lens, ...learningObject]),
    conceptId: buildGraphId("concept", concept),
    learningObjectId: buildGraphId("lo", learningObject),
    lensId: buildGraphId("lens", lens),
  };
}

/** Creates graph identity from a public route projection when the kind is inferable. */
export function createLearningGraphIdentityFromRoute(
  source: Omit<LearningGraphSource, "kind">
) {
  const route = normalizeGraphRoute(source.route);
  const kind = getLearningObjectKindForRoute(route);

  if (!kind) {
    return null;
  }

  return createLearningGraphIdentity({
    kind,
    locale: source.locale,
    route,
  });
}

/** Returns the stable lens hierarchy used by graph identity generation. */
export function getLearningGraphLensSegments(
  source: LearningGraphSource
): readonly string[] {
  const route = normalizeGraphRoute(source.route);
  const parts = route.split("/");

  assertRouteShape(source.kind, route, parts);

  return getLensSegments(source.kind, parts);
}

/** Normalizes one public route before graph identity derivation. */
export function normalizeGraphRoute(route: string) {
  return cleanSlug(route).split("/").filter(Boolean).join("/");
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
export function getLearningObjectKindForRoute(
  route: string
): LearningObjectKind | null {
  const parts = normalizeGraphRoute(route).split("/");
  const [root] = parts;

  if (root === "articles" && parts.length === 3) {
    return "article";
  }

  if (root === "quran" && parts.length === 2) {
    return "quran-surah";
  }

  if (root === "subject" && parts.length === 5) {
    return "subject-topic";
  }

  if (root === "subject" && parts.length === 6) {
    return "subject-section";
  }

  if (root === "exercises") {
    return getExerciseObjectKind(parts);
  }

  return null;
}

function cleanGraphSegment(segment: string) {
  return cleanSlug(segment).replaceAll("/", "-");
}

function getExerciseObjectKind(
  parts: readonly string[]
): LearningObjectKind | null {
  const lastPart = parts.at(-1);
  const parentPart = parts.at(-2);

  if (lastPart && parentPart?.startsWith("set-") && isNumberSegment(lastPart)) {
    return "exercise-question";
  }

  if (lastPart?.startsWith("set-")) {
    return "exercise-set";
  }

  if (parts.length === 5 || parts.length === 6) {
    return "exercise-group";
  }

  return null;
}

function isNumberSegment(segment: string) {
  const value = Number.parseInt(segment, 10);

  return Number.isSafeInteger(value) && String(value) === segment;
}

function assertRouteShape(
  kind: LearningObjectKind,
  route: string,
  parts: readonly string[]
) {
  const allowedLengths = KIND_ROUTE_LENGTHS[kind];

  if (allowedLengths.some((length) => length === parts.length)) {
    return;
  }

  throw new Error(
    `Invalid ${kind} graph route "${route}". Expected ${allowedLengths.join(" or ")} segments.`
  );
}

function getLensSegments(kind: LearningObjectKind, parts: readonly string[]) {
  if (kind === "article") {
    return ["article", parts[1] ?? ""];
  }

  if (kind === "quran-surah") {
    return ["quran"];
  }

  if (kind.startsWith("subject-")) {
    return ["subject", parts[1] ?? "", parts[2] ?? "", parts[3] ?? ""];
  }

  return ["exercise", parts[1] ?? "", parts[2] ?? "", parts[3] ?? ""];
}

function getConceptSegments(
  kind: LearningObjectKind,
  parts: readonly string[]
) {
  if (kind === "article") {
    return ["article", parts[1] ?? ""];
  }

  if (kind === "quran-surah") {
    return ["quran", "surah", parts[1] ?? ""];
  }

  if (kind.startsWith("subject-")) {
    return ["subject", parts[3] ?? "", parts[4] ?? ""];
  }

  return ["exercise", parts[3] ?? "", parts[4] ?? ""];
}

function getLearningObjectSegments(
  kind: LearningObjectKind,
  parts: readonly string[]
) {
  if (kind === "article") {
    return ["article", parts[1] ?? "", parts[2] ?? ""];
  }

  if (kind === "quran-surah") {
    return ["quran-surah", parts[1] ?? ""];
  }

  if (kind.startsWith("subject-")) {
    return [kind, parts[3] ?? "", ...parts.slice(4)];
  }

  return [kind, parts[2] ?? "", parts[3] ?? "", ...parts.slice(4)];
}
