import { createExerciseProjection } from "@repo/contents/_types/graph/exercise";
import {
  isNumberSegment,
  joinRoute,
  normalizeSourceRouteProjection,
} from "@repo/contents/_types/graph/route";
import {
  getCurriculumLensScopeForKind,
  getSourceRegistryRootForKind,
  InvalidLearningGraphRouteError,
  LearningObjectKindSchema,
  type SourceRouteInput,
  SourceRouteInputSchema,
  type SourceRouteProjectionDraft,
} from "@repo/contents/_types/graph/schema";
import { Effect, Option, Schema } from "effect";

/** Infers graph projection metadata from one public route projection. */
export function getSourceRouteProjectionForRoute(route: string) {
  const normalizedRoute = normalizeSourceRouteProjection(route);
  const [root, ...segments] = normalizedRoute.split("/");
  const draft = createProjectionDraft(normalizedRoute, root, segments);

  if (!draft) {
    return null;
  }

  return finalizeProjection(draft);
}

/** Validates that one declared source kind matches its public route projection. */
export function getSourceRouteProjection(source: SourceRouteInput) {
  const projection = getSourceRouteProjectionForRoute(source.route);

  if (!projection || projection.kind !== source.kind) {
    return null;
  }

  return projection;
}

/** Returns the graph-owned exercise group route for a valid exercise set route. */
export function getExerciseSetGroupRoute(route: string) {
  return (
    getSourceRouteProjection({
      kind: "exercise-set",
      route,
    })?.parentRoute ?? null
  );
}

/** Decodes and parses a declared route projection with the graph domain error. */
export const parseSourceRouteProjection = Effect.fn(
  "contents.graph.parseSourceRouteProjection"
)(function* (input: unknown) {
  const source = yield* Schema.decodeUnknown(SourceRouteInputSchema)(
    input
  ).pipe(Effect.mapError(() => createInvalidUnknownSourceRouteError(input)));
  const projection = getSourceRouteProjection(source);

  if (projection) {
    return projection;
  }

  return yield* Effect.fail(createInvalidSourceRouteError(source));
});

/** Returns the Quran surah number encoded by a valid Quran source route. */
export function getQuranSurahNumberForRoute(route: string) {
  const projection = getSourceRouteProjection({
    kind: "quran-surah",
    route,
  });

  if (!(projection?.kind === "quran-surah" && projection.quran)) {
    return null;
  }

  return Number.parseInt(projection.quran.surahSegment, 10);
}

/** Decodes and parses a Quran route into its surah number with a typed failure. */
export const parseQuranSurahNumberForRoute = Effect.fn(
  "contents.graph.parseQuranSurahNumberForRoute"
)(function* (input: unknown) {
  const route = yield* Schema.decodeUnknown(Schema.String)(input).pipe(
    Effect.mapError(
      () =>
        new InvalidLearningGraphRouteError({
          message: "Invalid Quran graph route input.",
          route: "",
        })
    )
  );
  const surahNumber = getQuranSurahNumberForRoute(route);

  if (surahNumber !== null) {
    return surahNumber;
  }

  return yield* Effect.fail(
    createInvalidSourceRouteError({
      kind: "quran-surah",
      route,
    })
  );
});

/** Builds the single graph route-contract error used by parse APIs. */
function createInvalidSourceRouteError(source: SourceRouteInput) {
  const route = normalizeSourceRouteProjection(source.route);

  return new InvalidLearningGraphRouteError({
    kind: source.kind,
    message: `Invalid ${source.kind} graph route "${route}".`,
    route,
  });
}

/** Builds the graph route error for values that fail source input decoding. */
function createInvalidUnknownSourceRouteError(input: unknown) {
  const route = readUnknownRoute(input) ?? "";
  const kind = readUnknownKind(input);
  const parsedKind =
    kind === undefined
      ? Option.none()
      : Schema.decodeUnknownOption(LearningObjectKindSchema)(kind);

  return new InvalidLearningGraphRouteError({
    ...(Option.isSome(parsedKind) ? { kind: parsedKind.value } : {}),
    message: route
      ? `Invalid graph source route input "${normalizeSourceRouteProjection(route)}".`
      : "Invalid graph source route input.",
    route: normalizeSourceRouteProjection(route),
  });
}

/** Reads the route field from an unknown decoded-boundary value. */
function readUnknownRoute(input: unknown) {
  if (!(typeof input === "object" && input !== null && "route" in input)) {
    return;
  }

  const { route } = input;

  return typeof route === "string" ? route : undefined;
}

/** Reads the kind field from an unknown decoded-boundary value. */
function readUnknownKind(input: unknown) {
  if (!(typeof input === "object" && input !== null && "kind" in input)) {
    return;
  }

  const { kind } = input;

  return typeof kind === "string" ? kind : undefined;
}

/** Delegates one normalized source root to its owned projection grammar. */
function createProjectionDraft(
  route: string,
  root: string | undefined,
  segments: readonly string[]
) {
  if (root === "articles") {
    return createArticleProjection(route, segments);
  }

  if (root === "quran") {
    return createQuranProjection(route, segments);
  }

  if (root === "subject") {
    return createSubjectProjection(route, segments);
  }

  if (root === "exercises") {
    return createExerciseProjection(route, segments);
  }

  return null;
}

/** Projects an article route into article-domain graph metadata. */
function createArticleProjection(route: string, segments: readonly string[]) {
  const [domainSegment, slugSegment, ...extraSegments] = segments;

  if (!(domainSegment && slugSegment) || extraSegments.length > 0) {
    return null;
  }

  return {
    conceptSegments: ["article", domainSegment],
    kind: "article",
    learningObjectSegments: ["article", domainSegment, slugSegment],
    lensSegments: ["article", domainSegment],
    parentRoute: joinRoute("articles", domainSegment),
    route,
  } satisfies SourceRouteProjectionDraft;
}

/** Projects a Quran surah route into scripture graph metadata. */
function createQuranProjection(route: string, segments: readonly string[]) {
  const [surahSegment, ...extraSegments] = segments;

  if (
    !(surahSegment && isNumberSegment(surahSegment)) ||
    extraSegments.length
  ) {
    return null;
  }

  return {
    conceptSegments: ["quran", "surah", surahSegment],
    kind: "quran-surah",
    learningObjectSegments: ["quran-surah", surahSegment],
    lensSegments: ["quran"],
    parentRoute: "quran",
    quran: { surahSegment },
    route,
  } satisfies SourceRouteProjectionDraft;
}

/** Projects a subject topic or section route into curriculum graph metadata. */
function createSubjectProjection(route: string, segments: readonly string[]) {
  const [school, grade, subject, topic, section, ...extraSegments] = segments;

  if (!(school && grade && subject && topic) || extraSegments.length > 0) {
    return null;
  }

  const lensSegments = ["subject", school, grade, subject];
  const conceptSegments = ["subject", subject, topic];

  if (!section) {
    return {
      conceptSegments,
      kind: "subject-topic",
      learningObjectSegments: ["subject-topic", subject, topic],
      lensSegments,
      parentRoute: joinRoute("subject", school, grade, subject),
      route,
    } satisfies SourceRouteProjectionDraft;
  }

  return {
    conceptSegments,
    kind: "subject-section",
    learningObjectSegments: ["subject-section", subject, topic, section],
    lensSegments,
    parentRoute: joinRoute("subject", school, grade, subject, topic),
    route,
  } satisfies SourceRouteProjectionDraft;
}

/** Attaches derived root, scope, and depth metadata to one projection draft. */
function finalizeProjection(input: SourceRouteProjectionDraft) {
  return {
    ...input,
    depth: input.route.split("/").length,
    lensScope: getCurriculumLensScopeForKind(input.kind),
    sourceRoot: getSourceRegistryRootForKind(input.kind),
  };
}
