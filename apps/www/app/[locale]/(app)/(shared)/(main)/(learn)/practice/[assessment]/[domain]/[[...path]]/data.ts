import { getExerciseNumberPagination } from "@repo/contents/_lib/assessment/slug";
import type { ContentPagination } from "@repo/contents/_types/content";
import {
  findPublicContentRouteByPath,
  listPublicContentRoutes,
} from "@repo/contents/_types/route/content";
import { readPathWithoutNamespace } from "@repo/contents/_types/route/path";
import type { PublicContentRoute } from "@repo/contents/_types/route/schema";
import { Effect, Option } from "effect";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import {
  isLocalizedQuestionSegment,
  localizeQuestionPaginationItem,
  readExerciseSetSourceParts,
  readGroupTitle,
  readQuestionSourcePathParts,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/source";
import {
  fetchRuntimeExerciseQuestionPage,
  fetchRuntimeExerciseSetPage,
} from "@/lib/content/runtime";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type PracticeParams =
  PageProps<"/[locale]/practice/[assessment]/[domain]/[[...path]]">["params"];
type PracticeSetRoute = PublicContentRoute & { kind: "exercise-set" };
type PracticeQuestionRoute = PublicContentRoute & {
  kind: "exercise-question";
};
type PracticeRoute = PracticeSetRoute | PracticeQuestionRoute;
type RuntimeSetPage = NonNullable<
  Awaited<ReturnType<typeof fetchRuntimeExerciseSetPage>>
>;
type RuntimeQuestionPage = NonNullable<
  Awaited<ReturnType<typeof fetchRuntimeExerciseQuestionPage>>
>;

export type PracticeRouteData =
  | {
      kind: "single";
      exercise: RuntimeQuestionPage["exercise"];
      exerciseCount: RuntimeQuestionPage["exerciseCount"];
      exerciseFilePath: string;
      group: PracticeGroupContext;
      locale: Locale;
      route: PracticeQuestionRoute;
      setPath: string;
      setRoute: PracticeSetRoute;
    }
  | {
      kind: "set";
      exercises: RuntimeSetPage["exercises"];
      group: PracticeGroupContext;
      locale: Locale;
      pagePath: string;
      route: PracticeSetRoute;
    }
  | {
      kind: "year-group";
      group: PracticeGroupContext;
      locale: Locale;
      pagePath: string;
    };

type PracticeGroupContext = ReturnType<typeof readPracticeGroupContext>;

export const PRACTICE_ROUTES = Effect.runSync(listPublicContentRoutes());

/**
 * Builds practice set params from projected public practice routes.
 *
 * Question pages are generated dynamically from their set and localized final
 * question segment, so static params stay bounded by authored exercise sets.
 */
export function listPracticeStaticParams() {
  return PRACTICE_ROUTES.filter(isPracticeSetRoute).map((route) => {
    const [, assessment, domain, ...path] = route.publicPath.split("/");

    return { assessment, domain, path };
  });
}

/**
 * Resolves practice params into the old explicit page variants.
 *
 * The returned data keeps public paths for links and source paths for Convex
 * runtime rows, attempts, and compiled MDX question/answer imports.
 */
export async function getPracticeRouteData(
  params: PracticeParams
): Promise<PracticeRouteData> {
  const { locale: rawLocale, assessment, domain, path = [] } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const pathWithoutNamespace = [assessment, domain, ...path].join("/");
  const exactRoute = findPracticeRoute(locale, pathWithoutNamespace);

  if (exactRoute && isPracticeSetRoute(exactRoute)) {
    return await getSetRouteData(locale, exactRoute);
  }

  const questionRoute = findPracticeQuestionRoute({
    locale,
    path,
    setPathWithoutNamespace: [assessment, domain, ...path.slice(0, -1)].join(
      "/"
    ),
  });

  if (questionRoute) {
    return await getSingleRouteData(locale, questionRoute);
  }

  const groupSet = PRACTICE_ROUTES.find(
    (candidate) =>
      candidate.locale === locale &&
      isPracticeSetRoute(candidate) &&
      candidate.parentPath !== undefined &&
      readPathWithoutNamespace(candidate.parentPath) === pathWithoutNamespace
  );

  if (!(groupSet && isPracticeSetRoute(groupSet) && groupSet.parentPath)) {
    notFound();
  }

  return getGroupRouteData(locale, groupSet.parentPath);
}

/**
 * Resolves the source set slug used by attempt providers and view tracking.
 *
 * Returning null for group pages keeps navigation-only pages from creating an
 * exercise attempt context for no concrete set.
 */
export async function getPracticeRuntimeSetPath(
  params: PracticeParams
): Promise<{ locale: Locale; routePath?: string; setPath?: string }> {
  const data = await getPracticeRouteData(params);

  if (data.kind === "year-group") {
    return {
      locale: data.locale,
      routePath: readPathWithoutLocale(data.pagePath),
    };
  }

  return {
    locale: data.locale,
    routePath:
      data.kind === "set" ? data.route.publicPath : data.route.publicPath,
    setPath: data.kind === "set" ? data.route.sourcePath : data.setPath,
  };
}

/** Creates previous and next question links for one public question route. */
export function getPracticeQuestionPagination({
  publicSetPath,
  questionNumber,
  totalExercises,
  titleFormatter,
}: {
  publicSetPath: string;
  questionNumber: number;
  titleFormatter: (number: number) => string;
  totalExercises: number;
}): ContentPagination {
  const pagination = getExerciseNumberPagination(
    publicSetPath,
    questionNumber,
    totalExercises,
    titleFormatter
  );

  return {
    prev: localizeQuestionPaginationItem(pagination.prev),
    next: localizeQuestionPaginationItem(pagination.next),
  };
}

/**
 * Converts a projected route row to a locale-prefixed app href.
 *
 * Practice pages use these public URLs for learner navigation while the attempt
 * store continues to use the source set slug.
 */
export function toPracticeHref(
  route: Pick<PracticeRoute, "locale" | "publicPath">
) {
  return `/${route.locale}/${route.publicPath}`;
}

/**
 * Reads one practice group context from projected public route rows.
 *
 * The group context feeds the established `CardMaterial` navigation component
 * with public set links.
 */
function readPracticeGroupContext(locale: Locale, groupPath: string) {
  const sets = PRACTICE_ROUTES.filter(
    (candidate) =>
      candidate.locale === locale &&
      isPracticeSetRoute(candidate) &&
      candidate.parentPath === groupPath
  );
  const firstSet = sets.at(0);

  if (!(firstSet && isPracticeSetRoute(firstSet))) {
    notFound();
  }

  const sourceParts = readExerciseSetSourceParts(firstSet.sourcePath);

  return {
    description: firstSet.description,
    materialPath: `/${locale}/${groupPath}`,
    pagePath: `/${locale}/${groupPath}`,
    sourceMaterial: sourceParts.material,
    sourceType: sourceParts.type,
    material: {
      title: readGroupTitle(firstSet),
      description: firstSet.description,
      href: `/${locale}/${groupPath}`,
      items: sets.map((set) => ({
        href: toPracticeHref(set),
        title: set.title,
      })),
    },
  };
}

/** Loads the restored set page data from the Convex runtime read model. */
async function getSetRouteData(
  locale: Locale,
  route: PracticeSetRoute
): Promise<PracticeRouteData> {
  const setPage = await fetchRuntimeExerciseSetPage({
    locale,
    slug: route.sourcePath,
  });

  if (!(setPage && route.parentPath)) {
    notFound();
  }

  return {
    kind: "set",
    exercises: setPage.exercises,
    group: readPracticeGroupContext(locale, route.parentPath),
    locale,
    pagePath: toPracticeHref(route),
    route,
  };
}

/** Loads the restored single-question page data from the Convex runtime row. */
async function getSingleRouteData(
  locale: Locale,
  route: PracticeQuestionRoute
): Promise<PracticeRouteData> {
  const { questionNumber, setSourcePath } = readQuestionSourcePathParts(
    route.sourcePath
  );
  const questionPage = await fetchRuntimeExerciseQuestionPage({
    locale,
    slug: `${setSourcePath}/${questionNumber}`,
  });
  const setRoute = PRACTICE_ROUTES.find(
    (candidate) =>
      candidate.locale === locale &&
      isPracticeSetRoute(candidate) &&
      candidate.publicPath === route.parentPath
  );

  if (!(questionPage && setRoute && isPracticeSetRoute(setRoute))) {
    notFound();
  }

  return {
    kind: "single",
    exercise: questionPage.exercise,
    exerciseCount: questionPage.exerciseCount,
    exerciseFilePath: toPracticeHref(route),
    group: readPracticeGroupContext(locale, setRoute.parentPath ?? ""),
    locale,
    route,
    setPath: setSourcePath,
    setRoute,
  };
}

/** Resolves a practice year group from projected public practice rows. */
function getGroupRouteData(
  locale: Locale,
  groupPath: string
): PracticeRouteData {
  const setRoute = PRACTICE_ROUTES.find(
    (candidate) =>
      candidate.locale === locale &&
      isPracticeSetRoute(candidate) &&
      candidate.parentPath === groupPath
  );

  if (!(setRoute && isPracticeSetRoute(setRoute))) {
    notFound();
  }

  return {
    kind: "year-group",
    group: readPracticeGroupContext(locale, groupPath),
    locale,
    pagePath: `/${locale}/${groupPath}`,
  };
}

/** Finds one projected practice route by localized path without namespace. */
function findPracticeRoute(
  locale: Locale,
  pathWithoutNamespace: string
): PracticeRoute | undefined {
  for (const candidate of PRACTICE_ROUTES) {
    if (!isPracticeRoute(candidate)) {
      continue;
    }

    if (candidate.locale !== locale) {
      continue;
    }

    if (
      readPathWithoutNamespace(candidate.publicPath) !== pathWithoutNamespace
    ) {
      continue;
    }

    return candidate;
  }

  return;
}

/**
 * Resolves a localized `soal-*` or `question-*` URL through route projection.
 *
 * Exercise question rows are derived from their set source and are not part of
 * the bounded static set inventory. Calling the Effect route projection here
 * keeps the localized public question path schema-owned instead of rebuilding
 * it in the app route.
 */
function findPracticeQuestionRoute({
  locale,
  path,
  setPathWithoutNamespace,
}: {
  locale: Locale;
  path: readonly string[];
  setPathWithoutNamespace: string;
}) {
  const questionSegment = path.at(-1);

  if (!isLocalizedQuestionSegment(locale, questionSegment)) {
    return;
  }

  const setRoute = findPracticeRoute(locale, setPathWithoutNamespace);

  if (!(setRoute && isPracticeSetRoute(setRoute))) {
    return;
  }

  const routeOption = Effect.runSync(
    findPublicContentRouteByPath(
      `${setRoute.publicPath}/${questionSegment}`,
      locale
    )
  );

  if (Option.isNone(routeOption)) {
    return;
  }

  const route = routeOption.value;

  if (!isPracticeQuestionRoute(route)) {
    return;
  }

  return route;
}

/** Checks whether one content route is a practice set or question row. */
function isPracticeRoute(route: PublicContentRoute): route is PracticeRoute {
  return route.kind === "exercise-set" || route.kind === "exercise-question";
}

/** Checks whether one content route is an authored exercise set row. */
function isPracticeSetRoute(
  route: PublicContentRoute
): route is PracticeSetRoute {
  return route.kind === "exercise-set";
}

/** Checks whether one content row is a projected exercise question row. */
function isPracticeQuestionRoute(
  route: PublicContentRoute
): route is PracticeQuestionRoute {
  return route.kind === "exercise-question";
}

/** Removes a leading locale segment from one app href. */
function readPathWithoutLocale(href: string) {
  return href.split("/").filter(Boolean).slice(1).join("/");
}
