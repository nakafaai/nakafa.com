import { getExerciseNumberPagination } from "@repo/contents/_lib/assessment/slug";
import type { ContentPagination } from "@repo/contents/_types/content";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import {
  findPracticeGroupSet,
  findPracticeRoute,
  type PracticeQuestionRoute,
  type PracticeSetRoute,
  type PublicPracticeRouteRows,
  readPracticeQuestionRoute,
  readPracticeRoutes,
  toPracticeHref,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/routes";
import {
  localizeQuestionPaginationItem,
  readExerciseSetSourceParts,
  readGroupTitle,
  readQuestionSourcePathParts,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/source";
import {
  fetchRuntimeExerciseQuestionPage,
  fetchRuntimeExerciseSetPage,
} from "@/lib/content/runtime/pages";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type PracticeParams =
  PageProps<"/[locale]/practice/[assessment]/[domain]/[[...path]]">["params"];
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
      publicPath: string;
    };

type PracticeGroupContext = ReturnType<typeof readPracticeGroupContext>;

/**
 * Builds practice set params from projected public practice routes.
 *
 * Question pages are generated dynamically from their set and localized final
 * question segment, so static params stay bounded by authored exercise sets.
 */
export function listPracticeStaticParams() {
  return readPracticeRoutes().map((route) => {
    const [, assessment, domain, ...path] = route.publicPath.split("/");

    return { assessment, domain, path };
  });
}

/**
 * Resolves practice params into the canonical practice page variants.
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
  const routes = readPracticeRoutes();
  const exactRoute = findPracticeRoute(routes, locale, pathWithoutNamespace);

  if (exactRoute) {
    return await getSetRouteData(locale, exactRoute, routes);
  }

  const questionRoute = readPracticeQuestionRoute({
    locale,
    path,
    routes,
    setPathWithoutNamespace: [assessment, domain, ...path.slice(0, -1)].join(
      "/"
    ),
  });

  if (questionRoute) {
    return await getSingleRouteData(locale, questionRoute, routes);
  }

  const groupSet = findPracticeGroupSet(routes, locale, pathWithoutNamespace);

  if (!groupSet) {
    notFound();
  }

  return getGroupRouteData(locale, groupSet, routes);
}

/**
 * Resolves the source set slug used by attempt providers and view tracking.
 *
 * Returning null for group pages keeps navigation-only pages from creating an
 * exercise attempt context for no concrete set.
 */
export async function getPracticeRuntimeSetPath(
  params: PracticeParams
): Promise<{
  locale: Locale;
  routePath?: string;
  setPath?: string;
}> {
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
 * Reads one practice group context from projected public route rows.
 *
 * The group context feeds the established `CardMaterial` navigation component
 * with public set links.
 */
function readPracticeGroupContext(
  locale: Locale,
  setRoute: PracticeSetRoute,
  routes: PublicPracticeRouteRows
) {
  const sets = routes.filter(
    (candidate) =>
      candidate.locale === locale &&
      candidate.parentPath === setRoute.parentPath
  );
  const sourceParts = readExerciseSetSourceParts(setRoute.sourcePath);

  const description = setRoute.description;

  return {
    description,
    alternatePaths: readPracticeGroupAlternatePaths(
      setRoute.sourcePath,
      routes
    ),
    materialPath: `/${locale}/${setRoute.parentPath}`,
    pagePath: `/${locale}/${setRoute.parentPath}`,
    sourceMaterial: sourceParts.material,
    sourceType: sourceParts.type,
    material: {
      title: readGroupTitle(setRoute),
      description,
      href: `/${locale}/${setRoute.parentPath}`,
      items: sets.map((set) => ({
        href: toPracticeHref(set),
        title: set.title,
      })),
    },
  };
}

/** Loads canonical set page data from the Convex runtime read model. */
async function getSetRouteData(
  locale: Locale,
  route: PracticeSetRoute,
  routes: PublicPracticeRouteRows
): Promise<PracticeRouteData> {
  const setPage = await fetchRuntimeExerciseSetPage({
    locale,
    slug: route.sourcePath,
  });

  if (!setPage) {
    notFound();
  }

  return {
    kind: "set",
    exercises: setPage.exercises,
    group: readPracticeGroupContext(locale, route, routes),
    locale,
    pagePath: toPracticeHref(route),
    route,
  };
}

/** Loads canonical single-question page data from the Convex runtime row. */
async function getSingleRouteData(
  locale: Locale,
  route: PracticeQuestionRoute,
  routes: PublicPracticeRouteRows
): Promise<PracticeRouteData> {
  const { questionNumber, setSourcePath } = readQuestionSourcePathParts(
    route.sourcePath
  );
  const questionPage = await fetchRuntimeExerciseQuestionPage({
    locale,
    slug: `${setSourcePath}/${questionNumber}`,
  });
  const setRoute = routes.find(
    (candidate) =>
      candidate.locale === locale && candidate.publicPath === route.parentPath
  );

  if (!(questionPage && setRoute)) {
    notFound();
  }

  return {
    kind: "single",
    exercise: questionPage.exercise,
    exerciseCount: questionPage.exerciseCount,
    exerciseFilePath: toPracticeHref(route),
    group: readPracticeGroupContext(locale, setRoute, routes),
    locale,
    route,
    setPath: setSourcePath,
    setRoute,
  };
}

/** Resolves a practice year group from projected public practice rows. */
function getGroupRouteData(
  locale: Locale,
  setRoute: PracticeSetRoute,
  routes: PublicPracticeRouteRows
): PracticeRouteData {
  return {
    kind: "year-group",
    group: readPracticeGroupContext(locale, setRoute, routes),
    locale,
    pagePath: `/${locale}/${setRoute.parentPath}`,
    publicPath: setRoute.parentPath,
  };
}

/** Finds localized public group paths from sibling set rows with the same source group. */
function readPracticeGroupAlternatePaths(
  sourceSetPath: string,
  routes: PublicPracticeRouteRows
) {
  const sourceGroupPath = sourceSetPath.split("/").slice(0, -1).join("/");
  const paths: Array<{ locale: Locale; publicPath: string }> = [];
  const seen = new Set<string>();

  for (const route of routes) {
    const candidateGroupPath = route.sourcePath
      .split("/")
      .slice(0, -1)
      .join("/");

    if (candidateGroupPath !== sourceGroupPath) {
      continue;
    }

    const key = `${route.locale}:${route.parentPath}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    paths.push({ locale: route.locale, publicPath: route.parentPath });
  }

  return paths;
}

/** Removes a leading locale segment from one app href. */
function readPathWithoutLocale(href: string) {
  return href.split("/").filter(Boolean).slice(1).join("/");
}
