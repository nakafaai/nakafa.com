import { getExerciseNumberPagination } from "@repo/contents/_lib/assessment/slug";
import type { ContentPagination } from "@repo/contents/_types/content";
import {
  readPublicPracticeAssessmentPath,
  readPublicPracticeDomainPath,
} from "@repo/contents/_types/route/practice/path";
import { notFound } from "next/navigation";
import type { Locale } from "next-intl";
import { readPracticeSetDisplay } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/display";
import {
  findPracticeDomainRoutes,
  findPracticeRoute,
  type PracticeQuestionRoute,
  type PracticeRoute,
  type PracticeSetRoute,
  type PublicPracticeRouteRows,
  readPracticeQuestionRoute,
  readPracticeRoutes,
  toPracticeHref,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/routes";
import {
  readPracticeDomainSeoContext,
  readPracticeRouteSeoContext,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/seo";
import {
  localizeQuestionPaginationItem,
  readExerciseSetSourceParts,
  readQuestionSourcePathParts,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/practice/[assessment]/[domain]/[[...path]]/source";
import {
  fetchRuntimeExerciseQuestionPage,
  fetchRuntimeExerciseSetPage,
} from "@/lib/content/runtime/pages";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { selectLearningStaticParams } from "@/lib/routing/prerender";
import type { SEOContext } from "@/lib/utils/seo/types";

type PracticeParams =
  PageProps<"/[locale]/practice/[assessment]/[domain]/[[...path]]">["params"];
type RuntimeSetPage = NonNullable<
  Awaited<ReturnType<typeof fetchRuntimeExerciseSetPage>>
>;
type RuntimeQuestionPage = NonNullable<
  Awaited<ReturnType<typeof fetchRuntimeExerciseQuestionPage>>
>;
type ExerciseSetSourceParts = ReturnType<typeof readExerciseSetSourceParts>;
type ProjectedPracticeRoute =
  | {
      kind: "domain";
      routes: readonly [PracticeSetRoute, ...PracticeSetRoute[]];
    }
  | { kind: "set"; route: PracticeSetRoute }
  | { kind: "single"; route: PracticeQuestionRoute };

export type PracticeRouteData =
  | {
      kind: "domain";
      alternatePaths: Array<{ locale: Locale; publicPath: string }>;
      assessmentPath: string;
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
export type PracticeMetadataData =
  | {
      kind: "domain";
      alternatePaths: Array<{ locale: Locale; publicPath: string }>;
      locale: Locale;
      publicPath: string;
      seoContext: Extract<SEOContext, { type: "exercise" }>;
      sourceMaterial: ExerciseSetSourceParts["material"];
    }
  | {
      kind: "route";
      locale: Locale;
      route: PracticeRoute;
      seoContext: Extract<SEOContext, { type: "exercise" }>;
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

  return selectLearningStaticParams(Array.from(paramsByPath.values()));
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
  const routes = readPracticeRoutes();
  const projectedRoute = resolveProjectedPracticeRoute({
    assessment,
    domain,
    locale,
    path,
    routes,
  });

  if (projectedRoute.kind === "set") {
    return await getSetRouteData(locale, projectedRoute.route, routes);
  }

  if (projectedRoute.kind === "single") {
    return await getSingleRouteData(locale, projectedRoute.route, routes);
  }

  return getDomainRouteData(locale, projectedRoute.routes, routes);
}

/**
 * Resolves metadata fields from projected practice route rows.
 *
 * Metadata does not need runtime exercise rows, so this stays independent of
 * Convex-backed page reads during Cache Components prerendering.
 */
export async function getPracticeMetadataData(
  params: PracticeParams
): Promise<PracticeMetadataData> {
  const { locale: rawLocale, assessment, domain, path = [] } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const routes = readPracticeRoutes();
  const projectedRoute = resolveProjectedPracticeRoute({
    assessment,
    domain,
    locale,
    path,
    routes,
  });

  if (projectedRoute.kind === "domain") {
    return getDomainMetadataData(locale, projectedRoute.routes, routes);
  }

  const seoContext = readPracticeRouteSeoContext(projectedRoute.route, routes);

  return {
    kind: "route",
    locale,
    route: projectedRoute.route,
    seoContext,
  };
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
  const display = readPracticeSetDisplay(setRoute);

  const description = setRoute.description;
  const assessmentPath = readPublicPracticeAssessmentPath(setRoute);
  const domainPath = readPublicPracticeDomainPath(setRoute);

  return {
    description,
    materialPath: `/${locale}/${domainPath}`,
    pagePath: `/${locale}/${assessmentPath}`,
    sourceMaterial: sourceParts.material,
    sourceType: sourceParts.type,
    material: {
      title: display.groupTitle,
      description,
      href: `/${locale}/${domainPath}`,
      items: sets.map((set) => ({
        href: toPracticeHref(set),
        title: set.title,
      })),
    },
  };
}

/** Matches localized practice params against projected route rows. */
function resolveProjectedPracticeRoute({
  assessment,
  domain,
  locale,
  path,
  routes,
}: {
  assessment: string;
  domain: string;
  locale: Locale;
  path: readonly string[];
  routes: PublicPracticeRouteRows;
}): ProjectedPracticeRoute {
  const pathWithoutNamespace = [assessment, domain, ...path].join("/");
  const exactRoute = findPracticeRoute(routes, locale, pathWithoutNamespace);

  if (exactRoute) {
    return { kind: "set", route: exactRoute };
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
    return { kind: "single", route: questionRoute };
  }

  const domainRoutes = findPracticeDomainRoutes(
    routes,
    locale,
    pathWithoutNamespace
  );

  if (!hasPracticeDomainRoutes(domainRoutes)) {
    notFound();
  }

  return { kind: "domain", routes: domainRoutes };
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

/** Resolves only the projected fields required for practice domain metadata. */
function getDomainMetadataData(
  locale: Locale,
  domainRoutes: readonly [PracticeSetRoute, ...PracticeSetRoute[]],
  routes: PublicPracticeRouteRows
): PracticeMetadataData {
  const firstRoute = domainRoutes[0];
  const sourceParts = readExerciseSetSourceParts(firstRoute.sourcePath);
  const publicPath = readPublicPracticeDomainPath(firstRoute);

  return {
    kind: "domain",
    alternatePaths: readPracticeDomainAlternatePaths(
      firstRoute.materialKey,
      routes
    ),
    locale,
    publicPath,
    seoContext: readPracticeDomainSeoContext(firstRoute),
    sourceMaterial: sourceParts.material,
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
    assessmentPath: `/${locale}/${readPublicPracticeAssessmentPath(firstRoute)}`,
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
