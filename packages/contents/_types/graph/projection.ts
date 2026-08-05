import {
  isNumberSegment,
  joinRoute,
  normalizeSourceRouteProjection,
} from "@repo/contents/_types/graph/route";
import {
  getCurriculumLensScopeForKind,
  getSourceRegistryRootForKind,
  type SourceRouteInput,
  type SourceRouteProjectionDraft,
} from "@repo/contents/_types/graph/schema";

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

/** Returns the Quran surah number encoded by a valid localized source route. */
export function getQuranSurahNumberForRoute(route: string) {
  const projection = getSourceRouteProjectionForRoute(route);

  if (!(projection?.kind === "quran-surah" && projection.quran)) {
    return null;
  }

  return Number.parseInt(projection.quran.surahSegment, 10);
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

  if (root === "material") {
    return createMaterialProjection(route, segments);
  }

  return null;
}

/** Projects final material source routes into graph metadata. */
function createMaterialProjection(route: string, segments: readonly string[]) {
  const [kindSegment, ...materialSegments] = segments;

  if (kindSegment === "lesson") {
    return createMaterialLessonProjection(route, materialSegments);
  }

  return null;
}

/** Projects a curriculum-neutral lesson material route into graph metadata. */
function createMaterialLessonProjection(
  route: string,
  segments: readonly string[]
) {
  const [domain, topic, section, ...extraSegments] = segments;

  if (!(domain && topic) || extraSegments.length > 0) {
    return null;
  }

  const lensSegments = ["material", "lesson", domain];
  const conceptSegments = ["material", "lesson", domain, topic];

  if (!section) {
    return {
      conceptSegments,
      kind: "curriculum-topic",
      learningObjectSegments: ["material-topic", domain, topic],
      lensSegments,
      parentRoute: joinRoute("material", "lesson", domain),
      route,
    } satisfies SourceRouteProjectionDraft;
  }

  return {
    conceptSegments,
    kind: "curriculum-lesson",
    learningObjectSegments: ["material-section", domain, topic, section],
    lensSegments,
    parentRoute: joinRoute("material", "lesson", domain, topic),
    route,
  } satisfies SourceRouteProjectionDraft;
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

/** Attaches derived root, scope, and depth metadata to one projection draft. */
function finalizeProjection(input: SourceRouteProjectionDraft) {
  return {
    ...input,
    depth: input.route.split("/").length,
    lensScope: getCurriculumLensScopeForKind(input.kind),
    sourceRoot: getSourceRegistryRootForKind(input.kind),
  };
}
