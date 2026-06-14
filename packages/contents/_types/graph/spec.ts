import { cleanSlug } from "@repo/utilities/helper";
import { Schema } from "effect";

/** Stable learning object kinds supported by graph identity generation. */
export const LEARNING_OBJECT_KIND_VALUES = [
  "article",
  "subject-topic",
  "subject-section",
  "exercise-group",
  "exercise-set",
  "exercise-question",
  "quran-surah",
] as const;

/** Runtime schema for graph learning object kinds. */
export const LearningObjectKindSchema = Schema.Literal(
  ...LEARNING_OBJECT_KIND_VALUES
);

/** Graph learning object kind derived from the runtime schema. */
export type LearningObjectKind = Schema.Schema.Type<
  typeof LearningObjectKindSchema
>;

/** Stable source roots accepted by the graph source registry adapter. */
export const SOURCE_REGISTRY_ROOT_VALUES = [
  "articles",
  "subject",
  "exercises",
  "quran",
] as const;

/** Runtime schema for graph source registry roots. */
export const SourceRegistryRootSchema = Schema.Literal(
  ...SOURCE_REGISTRY_ROOT_VALUES
);

/** Source registry root derived from the runtime schema. */
export type SourceRegistryRoot = Schema.Schema.Type<
  typeof SourceRegistryRootSchema
>;

/** Stable product scopes used to classify graph curriculum lenses. */
export const CURRICULUM_LENS_SCOPE_VALUES = [
  "article-domain",
  "curriculum",
  "exam",
  "scripture",
] as const;

/** Runtime schema for broad graph lens scopes. */
export const CurriculumLensScopeSchema = Schema.Literal(
  ...CURRICULUM_LENS_SCOPE_VALUES
);

/** Curriculum lens scope derived from the runtime schema. */
export type CurriculumLensScope = Schema.Schema.Type<
  typeof CurriculumLensScopeSchema
>;

/** Domain error for source routes that cannot project into graph identity. */
export class InvalidLearningGraphRouteError extends Schema.TaggedError<InvalidLearningGraphRouteError>()(
  "InvalidLearningGraphRouteError",
  {
    kind: Schema.optional(LearningObjectKindSchema),
    message: Schema.String,
    route: Schema.String,
  }
) {}

/** Adapter metadata derived from one source route projection into the graph. */
export interface SourceRouteProjection {
  readonly conceptSegments: readonly string[];
  readonly depth: number;
  readonly exercise?: {
    readonly categorySegment: string;
    readonly groupRoute: string;
    readonly groupSegments: readonly string[];
    readonly materialSegment: string;
    readonly questionSegment?: string;
    readonly setRoute?: string;
    readonly setSegment?: string;
    readonly typeSegment: string;
  };
  readonly kind: LearningObjectKind;
  readonly learningObjectSegments: readonly string[];
  readonly lensScope: CurriculumLensScope;
  readonly lensSegments: readonly string[];
  readonly parentRoute: string;
  readonly quran?: {
    readonly surahSegment: string;
  };
  readonly route: string;
  readonly sourceRoot: SourceRegistryRoot;
}

interface QuranSourceRouteProjection extends SourceRouteProjection {
  readonly kind: "quran-surah";
  readonly quran: {
    readonly surahSegment: string;
  };
}

interface SourceRouteInput {
  readonly kind: LearningObjectKind;
  readonly route: string;
}

const ROOT_BY_KIND = {
  article: "articles",
  "exercise-group": "exercises",
  "exercise-question": "exercises",
  "exercise-set": "exercises",
  "quran-surah": "quran",
  "subject-section": "subject",
  "subject-topic": "subject",
} as const satisfies Record<LearningObjectKind, SourceRegistryRoot>;

const LENS_SCOPE_BY_KIND = {
  article: "article-domain",
  "exercise-group": "exam",
  "exercise-question": "exam",
  "exercise-set": "exam",
  "quran-surah": "scripture",
  "subject-section": "curriculum",
  "subject-topic": "curriculum",
} as const satisfies Record<LearningObjectKind, CurriculumLensScope>;

/** Normalizes one public route before graph projection derivation. */
export function normalizeSourceRouteProjection(route: string) {
  return cleanSlug(route).split("/").filter(Boolean).join("/");
}

/** Infers graph projection metadata from one public route projection. */
export function getSourceRouteProjectionForRoute(route: string) {
  const normalizedRoute = normalizeSourceRouteProjection(route);
  const [root, ...segments] = normalizedRoute.split("/");

  if (root === "articles") {
    return createArticleProjection(normalizedRoute, segments);
  }

  if (root === "quran") {
    return createQuranProjection(normalizedRoute, segments);
  }

  if (root === "subject") {
    return createSubjectProjection(normalizedRoute, segments);
  }

  if (root === "exercises") {
    return createExerciseProjection(normalizedRoute, segments);
  }

  return null;
}

/** Validates that one declared source kind matches its public route projection. */
export function getSourceRouteProjection(source: SourceRouteInput) {
  const projection = getSourceRouteProjectionForRoute(source.route);

  if (!projection || projection.kind !== source.kind) {
    return null;
  }

  return projection;
}

/** Returns graph projection metadata or raises a typed route-contract error. */
export function requireSourceRouteProjection(source: SourceRouteInput) {
  const projection = getSourceRouteProjection(source);

  if (projection) {
    return projection;
  }

  const route = normalizeSourceRouteProjection(source.route);

  throw new InvalidLearningGraphRouteError({
    kind: source.kind,
    message: `Invalid ${source.kind} graph route "${route}".`,
    route,
  });
}

/** Returns the registry root owned by one graph object kind. */
export function getSourceRegistryRootForKind(kind: LearningObjectKind) {
  return ROOT_BY_KIND[kind];
}

/** Returns the broad lens scope owned by one graph object kind. */
export function getCurriculumLensScopeForKind(kind: LearningObjectKind) {
  return LENS_SCOPE_BY_KIND[kind];
}

/** Returns the Quran surah number encoded by a valid Quran source route. */
export function requireQuranSurahNumberForRoute(route: string) {
  const projection = getSourceRouteProjection({
    kind: "quran-surah",
    route,
  });

  if (!(projection && isQuranSourceRouteProjection(projection))) {
    throw new InvalidLearningGraphRouteError({
      kind: "quran-surah",
      message: `Invalid Quran graph route "${normalizeSourceRouteProjection(route)}".`,
      route,
    });
  }

  return Number.parseInt(projection.quran.surahSegment, 10);
}

function isQuranSourceRouteProjection(
  projection: SourceRouteProjection
): projection is QuranSourceRouteProjection {
  return projection.kind === "quran-surah" && projection.quran !== undefined;
}

function createArticleProjection(route: string, segments: readonly string[]) {
  const [domainSegment, slugSegment, ...extraSegments] = segments;

  if (!(domainSegment && slugSegment) || extraSegments.length > 0) {
    return null;
  }

  return createProjection({
    conceptSegments: ["article", domainSegment],
    kind: "article",
    learningObjectSegments: ["article", domainSegment, slugSegment],
    lensSegments: ["article", domainSegment],
    parentRoute: joinRoute("articles", domainSegment),
    route,
  });
}

function createQuranProjection(route: string, segments: readonly string[]) {
  const [surahSegment, ...extraSegments] = segments;

  if (
    !(surahSegment && isNumberSegment(surahSegment)) ||
    extraSegments.length
  ) {
    return null;
  }

  return createProjection({
    conceptSegments: ["quran", "surah", surahSegment],
    kind: "quran-surah",
    learningObjectSegments: ["quran-surah", surahSegment],
    lensSegments: ["quran"],
    parentRoute: "quran",
    quran: { surahSegment },
    route,
  });
}

function createSubjectProjection(route: string, segments: readonly string[]) {
  const [school, grade, subject, topic, section, ...extraSegments] = segments;

  if (!(school && grade && subject && topic) || extraSegments.length > 0) {
    return null;
  }

  const lensSegments = ["subject", school, grade, subject];
  const conceptSegments = ["subject", subject, topic];

  if (!section) {
    return createProjection({
      conceptSegments,
      kind: "subject-topic",
      learningObjectSegments: ["subject-topic", subject, topic],
      lensSegments,
      parentRoute: joinRoute("subject", school, grade, subject),
      route,
    });
  }

  return createProjection({
    conceptSegments,
    kind: "subject-section",
    learningObjectSegments: ["subject-section", subject, topic, section],
    lensSegments,
    parentRoute: joinRoute("subject", school, grade, subject, topic),
    route,
  });
}

function createExerciseProjection(route: string, segments: readonly string[]) {
  const [
    categorySegment,
    typeSegment,
    materialSegment,
    groupSegment,
    secondGroupOrSet,
    questionOrSet,
    finalSegment,
    ...extraSegments
  ] = segments;

  if (
    !(categorySegment && typeSegment && materialSegment && groupSegment) ||
    extraSegments.length > 0
  ) {
    return null;
  }

  const base = {
    categorySegment,
    materialSegment,
    route,
    typeSegment,
  };
  const baseRoute = joinRoute(
    "exercises",
    categorySegment,
    typeSegment,
    materialSegment
  );

  if (!secondGroupOrSet) {
    return createExerciseGroupProjection({
      ...base,
      baseRoute,
      groupSegments: [groupSegment],
    });
  }

  if (isSetSegment(secondGroupOrSet)) {
    return createExerciseItemProjection({
      ...base,
      extraSegment: finalSegment,
      groupSegments: [groupSegment],
      questionSegment: questionOrSet,
      setSegment: secondGroupOrSet,
    });
  }

  if (!questionOrSet) {
    return createExerciseGroupProjection({
      ...base,
      baseRoute,
      groupSegments: [groupSegment, secondGroupOrSet],
    });
  }

  if (!isSetSegment(questionOrSet)) {
    return null;
  }

  return createExerciseItemProjection({
    ...base,
    groupSegments: [groupSegment, secondGroupOrSet],
    questionSegment: finalSegment,
    setSegment: questionOrSet,
  });
}

function createExerciseGroupProjection(input: ExerciseGroupInput) {
  return createProjection({
    ...createExerciseProjectionBase(input),
    kind: "exercise-group",
    learningObjectSegments: [
      "exercise-group",
      input.typeSegment,
      input.materialSegment,
      ...input.groupSegments,
    ],
    parentRoute: input.baseRoute,
    route: input.route,
  });
}

function createExerciseItemProjection(input: ExerciseItemInput) {
  if (input.extraSegment) {
    return null;
  }

  const groupRoute = joinRoute(
    ...getExerciseRouteBase(input),
    ...input.groupSegments
  );
  const setRoute = joinRoute(groupRoute, input.setSegment);
  const base = createExerciseProjectionBase({ ...input, groupRoute, setRoute });

  if (!input.questionSegment) {
    return createProjection({
      ...base,
      kind: "exercise-set",
      learningObjectSegments: [
        "exercise-set",
        input.typeSegment,
        input.materialSegment,
        ...input.groupSegments,
        input.setSegment,
      ],
      parentRoute: groupRoute,
      route: input.route,
    });
  }

  if (!isNumberSegment(input.questionSegment)) {
    return null;
  }

  return createProjection({
    ...base,
    kind: "exercise-question",
    learningObjectSegments: [
      "exercise-question",
      input.typeSegment,
      input.materialSegment,
      ...input.groupSegments,
      input.setSegment,
      input.questionSegment,
    ],
    parentRoute: setRoute,
    route: input.route,
  });
}

function createExerciseProjectionBase(input: ExerciseInput) {
  const primaryGroupSegment = input.groupSegments[0];
  const groupRoute =
    input.groupRoute ??
    joinRoute(...getExerciseRouteBase(input), ...input.groupSegments);

  return {
    conceptSegments: ["exercise", input.materialSegment, primaryGroupSegment],
    exercise: {
      categorySegment: input.categorySegment,
      groupRoute,
      groupSegments: input.groupSegments,
      materialSegment: input.materialSegment,
      questionSegment:
        "questionSegment" in input ? input.questionSegment : undefined,
      setRoute: "setRoute" in input ? input.setRoute : undefined,
      setSegment: "setSegment" in input ? input.setSegment : undefined,
      typeSegment: input.typeSegment,
    },
    lensSegments: [
      "exercise",
      input.categorySegment,
      input.typeSegment,
      input.materialSegment,
    ],
  };
}

function createProjection(
  input: Omit<SourceRouteProjection, "depth" | "lensScope" | "sourceRoot">
) {
  return {
    ...input,
    depth: input.route.split("/").length,
    lensScope: getCurriculumLensScopeForKind(input.kind),
    sourceRoot: getSourceRegistryRootForKind(input.kind),
  };
}

function getExerciseRouteBase(
  input: Pick<
    ExerciseInput,
    "categorySegment" | "materialSegment" | "typeSegment"
  >
) {
  return [
    "exercises",
    input.categorySegment,
    input.typeSegment,
    input.materialSegment,
  ];
}

function isNumberSegment(segment: string) {
  const value = Number.parseInt(segment, 10);

  return Number.isSafeInteger(value) && String(value) === segment;
}

function isSetSegment(segment: string) {
  return segment.startsWith("set-");
}

function joinRoute(...segments: readonly string[]) {
  return segments.join("/");
}

interface ExerciseInput {
  readonly categorySegment: string;
  readonly groupRoute?: string;
  readonly groupSegments: readonly [string, ...string[]];
  readonly materialSegment: string;
  readonly questionSegment?: string;
  readonly route: string;
  readonly setRoute?: string;
  readonly setSegment?: string;
  readonly typeSegment: string;
}

interface ExerciseGroupInput extends ExerciseInput {
  readonly baseRoute: string;
}

interface ExerciseItemInput extends ExerciseInput {
  readonly extraSegment?: string;
  readonly questionSegment?: string;
  readonly setSegment: string;
}
