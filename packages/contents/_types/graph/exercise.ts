import {
  getExerciseQuestionNumberSegment,
  isExerciseSetSegment,
  joinRoute,
} from "@repo/contents/_types/graph/route";
import type { SourceRouteProjectionDraft } from "@repo/contents/_types/graph/schema";
import { Schema } from "effect";

/** Projects an exercise source route into graph metadata without route fallbacks. */
export function createExerciseProjection(
  route: string,
  segments: readonly string[]
): SourceRouteProjectionDraft | null {
  const [
    assessmentSegment,
    typeSegment,
    materialSegment,
    groupSegment,
    secondGroupOrSet,
    questionOrSet,
    finalSegment,
    ...extraSegments
  ] = segments;

  if (
    assessmentSegment !== "assessment" ||
    !(typeSegment && materialSegment && groupSegment) ||
    extraSegments.length > 0
  ) {
    return null;
  }

  const categorySegment = getPracticeCategorySegment(typeSegment);
  const baseRouteSegments = [
    "material",
    "practice",
    "assessment",
    typeSegment,
    materialSegment,
  ] as const;
  const base = {
    baseRouteSegments,
    categorySegment,
    materialSegment,
    route,
    typeSegment,
  };
  const baseRoute = joinRoute(...baseRouteSegments);

  if (!secondGroupOrSet) {
    return createExerciseGroupProjection({
      ...base,
      baseRoute,
      groupSegments: [groupSegment] as const,
    });
  }

  if (isExerciseSetSegment(secondGroupOrSet)) {
    return createExerciseItemProjection({
      ...base,
      extraSegment: finalSegment,
      groupSegments: [groupSegment] as const,
      questionSegment: questionOrSet,
      setSegment: secondGroupOrSet,
    });
  }

  if (!questionOrSet) {
    return createExerciseGroupProjection({
      ...base,
      baseRoute,
      groupSegments: [groupSegment, secondGroupOrSet] as const,
    });
  }

  if (!isExerciseSetSegment(questionOrSet)) {
    return null;
  }

  return createExerciseItemProjection({
    ...base,
    groupSegments: [groupSegment, secondGroupOrSet] as const,
    questionSegment: finalSegment,
    setSegment: questionOrSet,
  });
}

function getPracticeCategorySegment(typeSegment: string) {
  if (typeSegment === "grade-9") {
    return "middle-school";
  }

  return "high-school";
}

/** Builds an exercise group projection with its catalog parent route. */
function createExerciseGroupProjection(input: ExerciseGroupInput) {
  return {
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
  } satisfies SourceRouteProjectionDraft;
}

/** Builds an exercise set or question projection below a concrete group route. */
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
    return {
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
    } satisfies SourceRouteProjectionDraft;
  }

  const questionNumber = getExerciseQuestionNumberSegment(
    input.questionSegment
  );

  if (!questionNumber) {
    return null;
  }

  return {
    ...base,
    kind: "exercise-question",
    learningObjectSegments: [
      "exercise-question",
      input.typeSegment,
      input.materialSegment,
      ...input.groupSegments,
      input.setSegment,
      questionNumber,
    ],
    parentRoute: setRoute,
    route: input.route,
  } satisfies SourceRouteProjectionDraft;
}

/** Creates shared exercise graph segments from the route grammar base. */
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

/** Returns the fixed exercise source route prefix used before group segments. */
function getExerciseRouteBase(input: Pick<ExerciseInput, "baseRouteSegments">) {
  return input.baseRouteSegments;
}

/** Schema-owned local parser branch input before output assembly. */
const ExerciseInputSchema = Schema.Struct({
  baseRouteSegments: Schema.NonEmptyArray(Schema.String),
  categorySegment: Schema.String,
  groupRoute: Schema.optional(Schema.String),
  groupSegments: Schema.NonEmptyArray(Schema.String),
  materialSegment: Schema.String,
  questionSegment: Schema.optional(Schema.String),
  route: Schema.String,
  setRoute: Schema.optional(Schema.String),
  setSegment: Schema.optional(Schema.String),
  typeSegment: Schema.String,
});

/** Local parser branch input derived from its private schema. */
type ExerciseInput = Schema.Schema.Type<typeof ExerciseInputSchema>;

/** Schema-owned exercise group branch input with its catalog parent route. */
const ExerciseGroupInputSchema = ExerciseInputSchema.pipe(
  Schema.extend(
    Schema.Struct({
      baseRoute: Schema.String,
    })
  )
);

/** Exercise group parser input derived from its private schema. */
type ExerciseGroupInput = Schema.Schema.Type<typeof ExerciseGroupInputSchema>;

/** Schema-owned exercise set/question branch input with a required set. */
const ExerciseItemInputSchema = Schema.Struct({
  baseRouteSegments: Schema.NonEmptyArray(Schema.String),
  categorySegment: Schema.String,
  extraSegment: Schema.optional(Schema.String),
  groupRoute: Schema.optional(Schema.String),
  groupSegments: Schema.NonEmptyArray(Schema.String),
  materialSegment: Schema.String,
  questionSegment: Schema.optional(Schema.String),
  route: Schema.String,
  setRoute: Schema.optional(Schema.String),
  setSegment: Schema.String,
  typeSegment: Schema.String,
});

/** Exercise set/question parser input derived from its private schema. */
type ExerciseItemInput = Schema.Schema.Type<typeof ExerciseItemInputSchema>;
