import { type Locale, LocaleSchema } from "@repo/contents/_types/content";
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
import { isTryoutSetReady } from "@repo/contents/_types/tryout/readiness";
import type {
  TryoutExamSource,
  TryoutSetSource,
} from "@repo/contents/_types/tryout/schema";
import { TRYOUT_SOURCES } from "@repo/contents/_types/tryout/source";
import { Effect, Option, Schema } from "effect";

/** Source registries used to resolve public graph routes. */
export interface SourceRouteProjectionOptions {
  readonly tryouts?: readonly TryoutExamSource[];
}

/** Infers graph projection metadata from one public route projection. */
export function getSourceRouteProjectionForRoute(
  route: string,
  locale: Locale,
  { tryouts = TRYOUT_SOURCES }: SourceRouteProjectionOptions = {}
) {
  const normalizedRoute = normalizeSourceRouteProjection(route);
  const [root, ...segments] = normalizedRoute.split("/");
  const draft = createProjectionDraft(
    normalizedRoute,
    root,
    segments,
    locale,
    tryouts
  );

  if (!draft) {
    return null;
  }

  return finalizeProjection(draft);
}

/** Validates that one declared source kind matches its public route projection. */
export function getSourceRouteProjection(source: SourceRouteInput) {
  const projection = getSourceRouteProjectionForRoute(
    source.route,
    source.locale
  );

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

const QuranRouteInputSchema = Schema.Struct({
  locale: LocaleSchema,
  route: Schema.String,
});

/** Returns the Quran surah number encoded by a valid localized source route. */
export function getQuranSurahNumberForRoute(route: string, locale: Locale) {
  const projection = getSourceRouteProjection({
    kind: "quran-surah",
    locale,
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
  const source = yield* Schema.decodeUnknown(QuranRouteInputSchema)(input).pipe(
    Effect.mapError(
      () =>
        new InvalidLearningGraphRouteError({
          message: "Invalid Quran graph route input.",
          route: "",
        })
    )
  );
  const surahNumber = getQuranSurahNumberForRoute(source.route, source.locale);

  if (surahNumber !== null) {
    return surahNumber;
  }

  return yield* Effect.fail(
    createInvalidSourceRouteError({
      kind: "quran-surah",
      locale: source.locale,
      route: source.route,
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
  segments: readonly string[],
  locale: Locale,
  tryouts: readonly TryoutExamSource[]
) {
  if (root === "articles") {
    return createArticleProjection(route, segments);
  }

  if (root === "quran") {
    return createQuranProjection(route, segments);
  }

  if (root === "try-out") {
    return createTryoutProjection(route, segments, locale, tryouts);
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
function createTryoutProjection(
  route: string,
  segments: readonly string[],
  locale: Locale,
  tryouts: readonly TryoutExamSource[]
) {
  const [country, exam, track, set, section, ...extraSegments] = segments;

  if (!country || extraSegments.length > 0) {
    return null;
  }

  const source = findTryoutSource(tryouts, locale, country, exam);

  if (!source) {
    return null;
  }

  const countryRoute = joinRoute("try-out", country);
  const examRoute = exam ? joinRoute(countryRoute, exam) : countryRoute;
  const trackRoute = track ? joinRoute(examRoute, track) : examRoute;
  const setRoute = set ? joinRoute(trackRoute, set) : trackRoute;
  const countryKey = source.countryKey;
  const examKey = source.examKey;
  const lensSegments = exam
    ? ["tryout", countryKey, examKey]
    : ["tryout", countryKey, "catalog"];

  if (!exam) {
    return {
      conceptSegments: ["tryout", countryKey],
      kind: "tryout-country",
      learningObjectSegments: ["tryout-country", countryKey],
      lensSegments,
      parentRoute: "try-out",
      route,
    } satisfies SourceRouteProjectionDraft;
  }

  if (!track) {
    return {
      conceptSegments: ["tryout", countryKey, examKey],
      kind: "tryout-exam",
      learningObjectSegments: ["tryout-exam", countryKey, examKey],
      lensSegments,
      parentRoute: countryRoute,
      route,
    } satisfies SourceRouteProjectionDraft;
  }

  const sourceTrack = findTryoutTrack(source, locale, track);

  if (!sourceTrack) {
    return null;
  }

  const readySets = sourceTrack.sets.filter(isTryoutSetReady);

  if (readySets.length === 0) {
    return null;
  }

  if (!set) {
    return {
      conceptSegments: ["tryout", countryKey, examKey, sourceTrack.key],
      kind: "tryout-track",
      learningObjectSegments: [
        "tryout-track",
        countryKey,
        examKey,
        sourceTrack.key,
      ],
      lensSegments,
      parentRoute: examRoute,
      route,
    } satisfies SourceRouteProjectionDraft;
  }

  const sourceSet = readySets.find(
    (candidate) => candidate.routeSlugs[locale] === set
  );

  if (!sourceSet) {
    return null;
  }

  if (!section) {
    return {
      conceptSegments: [
        "tryout",
        countryKey,
        examKey,
        sourceTrack.key,
        sourceSet.key,
      ],
      kind: "tryout-set",
      learningObjectSegments: [
        "tryout-set",
        countryKey,
        examKey,
        sourceTrack.key,
        sourceSet.key,
      ],
      lensSegments,
      parentRoute: trackRoute,
      route,
    } satisfies SourceRouteProjectionDraft;
  }

  const sourceSection = findTryoutVisibleSection(sourceSet, locale, section);

  if (!sourceSection) {
    return null;
  }

  return {
    conceptSegments: [
      "tryout",
      countryKey,
      examKey,
      sourceTrack.key,
      sourceSection.key,
    ],
    kind: "tryout-section",
    learningObjectSegments: [
      "tryout-section",
      countryKey,
      examKey,
      sourceTrack.key,
      sourceSet.key,
      sourceSection.key,
    ],
    lensSegments,
    parentRoute: setRoute,
    route,
  } satisfies SourceRouteProjectionDraft;
}

/** Finds the try-out source that owns one localized country/exam route prefix. */
function findTryoutSource(
  tryouts: readonly TryoutExamSource[],
  locale: Locale,
  country: string,
  exam: string | undefined
) {
  for (const source of tryouts) {
    if (source.countryRouteSlugs[locale] !== country) {
      continue;
    }

    if (!exam) {
      return source;
    }

    if (source.examRouteSlugs[locale] === exam) {
      return source;
    }
  }

  return null;
}

/** Finds the source track that owns one localized track route segment. */
function findTryoutTrack(
  source: TryoutExamSource,
  locale: Locale,
  track: string
) {
  return source.tracks.find(
    (candidate) => candidate.routeSlugs[locale] === track
  );
}

/** Finds a public visible section that owns one localized section route segment. */
function findTryoutVisibleSection(
  set: TryoutSetSource,
  locale: Locale,
  section: string
) {
  return set.sections.find((candidate) => {
    if (candidate.visibility === "internal-entry") {
      return false;
    }

    return candidate.routeSlugs[locale] === section;
  });
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
