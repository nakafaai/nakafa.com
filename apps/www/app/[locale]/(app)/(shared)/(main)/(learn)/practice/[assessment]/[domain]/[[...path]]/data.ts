import { getExerciseNumberPagination } from "@repo/contents/_lib/assessment/slug";
import type { ContentPagination } from "@repo/contents/_types/content";
import { readPublicPracticeDomainPath } from "@repo/contents/_types/route/practice";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import {
  findPracticeDomainRoutes,
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
type ExerciseSetSourceParts = ReturnType<typeof readExerciseSetSourceParts>;

export type PracticeRouteData =
  | {
      kind: "domain";
      alternatePaths: Array<{ locale: Locale; publicPath: string }>;
      groups: PracticeGroupContext[];
      locale: Locale;
      pagePath: string;
      publicPath: string;
      sourceMaterial: ExerciseSetSourceParts["material"];
      sourceType: ExerciseSetSourceParts["type"];
    }
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
    };

type PracticeGroupContext = ReturnType<typeof readPracticeGroupContext>;

/**
 * Builds practice set params from projected public practice routes.
 *
 * Question pages are generated dynamically from their set and localized final
 * question segment, so static params stay bounded by authored exercise sets.
 */
export function listPracticeStaticParams(rawLocale?: string) {
  const locale = rawLocale ? getLocaleOrThrow(rawLocale) : undefined;
  const paramsByPath = new Map<
    string,
    { assessment: string; domain: string; path?: string[] }
  >();

  for (const route of readPracticeRoutes()) {
    if (locale && route.locale !== locale) {
      continue;
    }

    const [, assessment, domain, ...path] = route.publicPath.split("/");
    paramsByPath.set([route.locale, assessment, domain].join("/"), {
      assessment,
      domain,
    });
    paramsByPath.set([route.locale, assessment, domain, ...path].join("/"), {
      assessment,
      domain,
      path,
    });
  }

  return Array.from(paramsByPath.values());
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

  const domainRoutes = findPracticeDomainRoutes(
    routes,
    locale,
    pathWithoutNamespace
  );

  if (!hasPracticeDomainRoutes(domainRoutes)) {
    notFound();
  }

  return getDomainRouteData(locale, domainRoutes, routes);
}

/**
 * Resolves the source set slug used by attempt providers and view tracking.
 *
 * Domain pages return no concrete set slug, so navigation pages never create
 * exercise attempt context for a non-set route.
 */
export async function getPracticeRuntimeSetPath(
  params: PracticeParams
): Promise<{
  locale: Locale;
  routePath?: string;
  setPath?: string;
}> {
  const data = await getPracticeRouteData(params);

  if (data.kind === "domain") {
    return { locale: data.locale };
  }

  return {
    locale: data.locale,
    routePath:
      data.kind === "set" ? data.route.publicPath : data.setRoute.publicPath,
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
  const domainPath = readPublicPracticeDomainPath(setRoute);

  return {
    description,
    materialPath: `/${locale}/${domainPath}`,
    pagePath: `/${locale}/${domainPath}`,
    sourceMaterial: sourceParts.material,
    sourceType: sourceParts.type,
    material: {
      title: readGroupTitle(setRoute),
      description,
      href: `/${locale}/${domainPath}`,
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

/** Resolves a rendered practice domain from projected concrete set rows. */
function getDomainRouteData(
  locale: Locale,
  domainRoutes: readonly [PracticeSetRoute, ...PracticeSetRoute[]],
  routes: PublicPracticeRouteRows
): PracticeRouteData {
  const firstRoute = domainRoutes[0];

  const sourceParts = readExerciseSetSourceParts(firstRoute.sourcePath);
  const publicPath = readPublicPracticeDomainPath(firstRoute);
  const groups = Array.from(
    new Map(
      domainRoutes.map((route) => [
        route.parentPath,
        readPracticeGroupContext(locale, route, routes),
      ])
    ).values()
  );

  return {
    kind: "domain",
    alternatePaths: readPracticeDomainAlternatePaths(
      firstRoute.materialKey,
      routes
    ),
    groups,
    locale,
    pagePath: `/${locale}/${publicPath}`,
    publicPath,
    sourceMaterial: sourceParts.material,
    sourceType: sourceParts.type,
  };
}

/** Narrows projected set rows to the non-empty domain page input. */
function hasPracticeDomainRoutes(
  routes: readonly PracticeSetRoute[]
): routes is readonly [PracticeSetRoute, ...PracticeSetRoute[]] {
  return routes.length > 0;
}

/** Finds localized rendered domain paths from sibling set rows with the same material. */
function readPracticeDomainAlternatePaths(
  materialKey: PracticeSetRoute["materialKey"],
  routes: PublicPracticeRouteRows
) {
  const paths: Array<{ locale: Locale; publicPath: string }> = [];
  const seen = new Set<string>();

  for (const route of routes) {
    if (route.materialKey !== materialKey) {
      continue;
    }

    const publicPath = readPublicPracticeDomainPath(route);
    const key = `${route.locale}:${publicPath}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    paths.push({ locale: route.locale, publicPath });
  }

  return paths;
}
