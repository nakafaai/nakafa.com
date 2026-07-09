import type { Locale } from "@repo/contents/_types/content";
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
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
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

  if (root === "try-out") {
    return createTryoutProjection(route, segments);
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

/** Projects a try-out public route into graph metadata. */
function createTryoutProjection(route: string, segments: readonly string[]) {
  const [country, exam, track, set, section, ...extraSegments] = segments;

  if (!country || extraSegments.length > 0) {
    return null;
  }

  const source = findTryoutSource(country, exam);

  if (!source) {
    return null;
  }

  const countryRoute = joinRoute("try-out", country);
  const examRoute = exam ? joinRoute(countryRoute, exam) : countryRoute;
  const trackRoute = track ? joinRoute(examRoute, track) : examRoute;
  const setRoute = set ? joinRoute(trackRoute, set) : trackRoute;
  const lensSegments = exam
    ? ["tryout", country, exam]
    : ["tryout", country, "catalog"];

  if (!exam) {
    return {
      conceptSegments: ["tryout", country],
      kind: "tryout-country",
      learningObjectSegments: ["tryout-country", country],
      lensSegments,
      parentRoute: "try-out",
      route,
    } satisfies SourceRouteProjectionDraft;
  }

  if (!track) {
    return {
      conceptSegments: ["tryout", country, exam],
      kind: "tryout-exam",
      learningObjectSegments: ["tryout-exam", country, exam],
      lensSegments,
      parentRoute: countryRoute,
      route,
    } satisfies SourceRouteProjectionDraft;
  }

  const sourceTrack = findTryoutTrack(source, track);

  if (!sourceTrack) {
    return null;
  }

  if (!set) {
    return {
      conceptSegments: ["tryout", country, exam, track],
      kind: "tryout-track",
      learningObjectSegments: ["tryout-track", country, exam, track],
      lensSegments,
      parentRoute: examRoute,
      route,
    } satisfies SourceRouteProjectionDraft;
  }

  const sourceSet = findTryoutSet(sourceTrack, set);

  if (!sourceSet) {
    return null;
  }

  if (!section) {
    return {
      conceptSegments: ["tryout", country, exam, track, set],
      kind: "tryout-set",
      learningObjectSegments: ["tryout-set", country, exam, track, set],
      lensSegments,
      parentRoute: trackRoute,
      route,
    } satisfies SourceRouteProjectionDraft;
  }

  if (!findTryoutVisibleSection(sourceSet, section)) {
    return null;
  }

  return {
    conceptSegments: ["tryout", country, exam, track, section],
    kind: "tryout-section",
    learningObjectSegments: [
      "tryout-section",
      country,
      exam,
      track,
      set,
      section,
    ],
    lensSegments,
    parentRoute: setRoute,
    route,
  } satisfies SourceRouteProjectionDraft;
}

/** Finds the try-out source that owns one localized country/exam route prefix. */
function findTryoutSource(country: string, exam: string | undefined) {
  for (const source of TRYOUT_SOURCES) {
    if (!hasRouteSlug(source.countryRouteSlugs, country)) {
      continue;
    }

    if (!exam) {
      return source;
    }

    if (hasRouteSlug(source.examRouteSlugs, exam)) {
      return source;
    }
  }

  return null;
}

/** Finds the source track that owns one localized track route segment. */
function findTryoutTrack(source: TryoutSource, track: string) {
  return source.tracks.find((candidate) =>
    hasRouteSlug(candidate.routeSlugs, track)
  );
}

/** Finds the source set that owns one localized set route segment. */
function findTryoutSet(track: TryoutTrack, set: string) {
  return track.sets.find((candidate) =>
    hasRouteSlug(candidate.routeSlugs, set)
  );
}

/** Finds a public visible section that owns one localized section route segment. */
function findTryoutVisibleSection(set: TryoutSet, section: string) {
  return set.sections.find((candidate) => {
    if (candidate.visibility === "internal-entry") {
      return false;
    }

    return hasRouteSlug(candidate.routeSlugs, section);
  });
}

type TryoutSource = NonNullable<ReturnType<typeof findTryoutSource>>;
type TryoutTrack = TryoutSource["tracks"][number];
type TryoutSet = TryoutTrack["sets"][number];

/** Compares decoded route slugs to a normalized projection segment. */
function hasRouteSlug(
  slugs: Readonly<{ [Key in Locale]: string }>,
  segment: string
) {
  return Object.values(slugs).some((slug) => slug === segment);
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
