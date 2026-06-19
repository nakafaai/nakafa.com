import { ExercisesMaterialSchema } from "@repo/contents/_types/assessment/material";
import { ExercisesTypeSchema } from "@repo/contents/_types/assessment/type";
import type { Locale } from "@repo/contents/_types/content";
import { getSourceRouteProjectionForRoute } from "@repo/contents/_types/graph/projection";
import { MATERIAL_ROUTE_DOMAINS } from "@repo/contents/_types/material/domain";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import type { RouteInputs } from "@repo/contents/_types/route/input";
import { readPracticeSourceGroupIdentity } from "@repo/contents/_types/route/practice/path";
import { readPublicPracticeQuestionRouteByPath } from "@repo/contents/_types/route/practice/question";
import { readPublicPracticeSetRouteByPath } from "@repo/contents/_types/route/practice/set";
import { Option, Schema } from "effect";

/** Resolves localized public practice routes to source asset paths. */
export function readPublicPracticeSourceRouteByPath({
  domains = MATERIAL_ROUTE_DOMAINS,
  locale,
  materials = MATERIAL_SOURCES,
  publicPath,
}: {
  domains?: NonNullable<RouteInputs["domains"]>;
  locale: Locale;
  materials?: NonNullable<RouteInputs["materials"]>;
  publicPath: string;
}) {
  const questionRoute = readPublicPracticeQuestionRouteByPath({
    domains,
    locale,
    materials,
    publicPath,
  });

  if (questionRoute) {
    return { kind: "question" as const, sourcePath: questionRoute.sourcePath };
  }

  return readPublicPracticeSetRouteByPath({
    domains,
    locale,
    materials,
    publicPath,
  });
}

/** Reads a canonical source route from either public or source practice paths. */
export function readPracticeSourceRouteByPath({
  domains,
  locale,
  materials,
  route,
}: {
  domains?: NonNullable<RouteInputs["domains"]>;
  locale: Locale;
  materials?: NonNullable<RouteInputs["materials"]>;
  route: string;
}) {
  const publicRoute = readPublicPracticeSourceRouteByPath({
    domains,
    locale,
    materials,
    publicPath: route,
  });

  if (publicRoute) {
    return publicRoute;
  }

  const projection = getSourceRouteProjectionForRoute(route);

  if (projection?.kind === "exercise-question") {
    return { kind: "question" as const, sourcePath: projection.route };
  }

  if (projection?.kind === "exercise-set") {
    return { kind: "set" as const, sourcePath: projection.route };
  }

  return;
}

/** Reads runtime set arguments from one canonical practice source route. */
export function readPracticeSourceSetParts(sourcePath: string) {
  const projection = getSourceRouteProjectionForRoute(sourcePath);

  if (!projection?.exercise) {
    return;
  }

  if (
    !(
      projection.kind === "exercise-set" ||
      projection.kind === "exercise-question"
    )
  ) {
    return;
  }

  const { exercise } = projection;
  const group = exercise.groupSegments.at(0);
  const parsedType = Schema.decodeUnknownOption(ExercisesTypeSchema)(
    exercise.typeSegment
  );
  const parsedMaterial = Schema.decodeUnknownOption(ExercisesMaterialSchema)(
    exercise.materialSegment
  );

  if (
    !(
      group &&
      exercise.groupSegments.length === 1 &&
      exercise.setSegment &&
      Option.isSome(parsedType) &&
      Option.isSome(parsedMaterial)
    )
  ) {
    return;
  }

  return {
    ...readPracticeSourceGroupIdentity(group),
    material: parsedMaterial.value,
    type: parsedType.value,
  };
}

/** Reads one canonical question number and parent set path from a source question route. */
export function readPracticeQuestionSourceParts(sourcePath: string) {
  const projection = getSourceRouteProjectionForRoute(sourcePath);

  if (!(projection?.kind === "exercise-question" && projection.exercise)) {
    return;
  }

  const questionNumberSegment = projection.learningObjectSegments
    .slice(-1)
    .join("");

  return {
    questionNumber: Number.parseInt(questionNumberSegment, 10),
    setSourcePath: projection.parentRoute,
  };
}
