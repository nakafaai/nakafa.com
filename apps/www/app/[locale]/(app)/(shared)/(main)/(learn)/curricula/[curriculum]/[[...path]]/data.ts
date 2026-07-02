import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import { findLearningProgramByKey } from "@repo/contents/_types/program/catalog";
import { readStaticPublicContentRoutes } from "@repo/contents/_types/route/content/static";
import {
  compareCurriculumRouteOrder,
  isRenderableCurriculumRoute,
  readCurriculumAncestors,
  readCurriculumRouteByPublicPath,
} from "@repo/contents/_types/route/curriculum";
import { readCurriculumMaterialCards } from "@repo/contents/_types/route/curriculum/card";
import { readStaticPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum/static";
import { readPathWithoutNamespace } from "@repo/contents/_types/route/path";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
} from "@repo/contents/_types/route/schema";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";
import { notFound } from "next/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";
import { selectLearningStaticParams } from "@/lib/routing/prerender";

type CurriculumParams =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">["params"];

let curriculumRouteCache: readonly PublicCurriculumRoute[] | undefined;
let materialRouteCache: readonly PublicContentRoute[] | undefined;

/** Lazily decodes curriculum routes when a framework route function needs them. */
export function readCurriculumRoutes() {
  if (curriculumRouteCache) {
    return curriculumRouteCache;
  }

  curriculumRouteCache = readStaticPublicCurriculumRoutes();

  return curriculumRouteCache;
}

/** Lazily decodes content routes used by curriculum material-card indexes. */
export function readMaterialRoutes() {
  if (materialRouteCache) {
    return materialRouteCache;
  }

  materialRouteCache = readStaticPublicContentRoutes();

  return materialRouteCache;
}

/** Builds static params for rendered curriculum context pages only. */
export function listCurriculumStaticParams(rawLocale?: string) {
  const locale = rawLocale ? getLocaleOrThrow(rawLocale) : undefined;

  const params = readCurriculumRoutes()
    .filter((route) => !locale || route.locale === locale)
    .filter(isRenderableCurriculumRoute)
    .map((route) => {
      const [, curriculum, ...path] = route.publicPath.split("/");

      return path.length > 0 ? { curriculum, path } : { curriculum };
    });

  return selectLearningStaticParams(params);
}

/** Resolves localized curriculum params through projected route rows. */
export async function resolveCurriculumRoute(params: CurriculumParams) {
  const { locale: rawLocale, curriculum, path } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const routePath = [curriculum, ...(path ?? [])].join("/");
  const route = readCurriculumRoutes().find(
    (candidate) =>
      candidate.locale === locale &&
      readPathWithoutNamespace(candidate.publicPath) === routePath
  );

  if (!(route && isRenderableCurriculumRoute(route))) {
    notFound();
  }

  return { locale, route };
}

/** Builds the render model for one curriculum page from projected rows. */
export function readCurriculumRouteModel({
  locale,
  route,
}: Awaited<ReturnType<typeof resolveCurriculumRoute>>) {
  const curriculumRoutes = readCurriculumRoutes();
  const childRoutes = curriculumRoutes
    .filter(
      (child) =>
        child.locale === locale && child.parentPath === route.publicPath
    )
    .filter(isRenderableCurriculumRoute)
    .slice()
    .sort(compareCurriculumRouteOrder);
  const materialCards = isMaterialCardListRoute(route)
    ? readCurriculumMaterialCards({
        contentRoutes: readMaterialRoutes(),
        curriculumRoutes,
        route,
      })
    : [];
  const childGroups = groupCurriculumChildren(childRoutes);
  return {
    childGroups,
    childRoutes,
    locale,
    materialCards,
    route,
  };
}

/** Builds the root curriculum select options from projected route and catalog sources. */
export function readCurriculumRootOptions(
  locale: PublicCurriculumRoute["locale"]
) {
  return readCurriculumRoutes()
    .filter(
      (route) =>
        route.locale === locale &&
        route.level === "track" &&
        isRenderableCurriculumRoute(route)
    )
    .slice()
    .sort(compareCurriculumRouteOrder)
    .map((route) => {
      const program = findLearningProgramByKey(route.programKey);

      return {
        countryCode: program?.provider.homeCountry,
        href: `/${locale}/${route.publicPath}`,
        title: route.title,
        value: route.publicPath,
      };
    });
}

/** Builds the small parent link shown above curriculum page titles. */
export function readCurriculumHeaderLink(
  locale: PublicCurriculumRoute["locale"],
  route: PublicCurriculumRoute
) {
  if (!route.parentPath) {
    return;
  }

  const parent = readCurriculumRouteByPublicPath(
    readCurriculumRoutes(),
    locale,
    route.parentPath
  );

  if (!(parent && isRenderableCurriculumRoute(parent))) {
    return;
  }

  return {
    href: `/${locale}/${parent.publicPath}`,
    label: parent.title,
  };
}

/** Builds the right-sidebar header with the immediate curriculum parent context. */
export function readCurriculumTocHeader(
  locale: PublicCurriculumRoute["locale"],
  route: PublicCurriculumRoute
) {
  const parentLink = readCurriculumHeaderLink(locale, route);

  if (parentLink) {
    return {
      title: route.title,
      href: `/${locale}/${route.publicPath}`,
      description: parentLink.label,
    };
  }

  return {
    title: route.title,
    href: `/${locale}/${route.publicPath}`,
  };
}

/** Reads the projected breadcrumb chain for one curriculum page. */
export function readCurriculumBreadcrumbs(
  homeLabel: string,
  route: PublicCurriculumRoute
) {
  const breadcrumbs = [{ name: homeLabel, path: "" }];
  const ancestors = readCurriculumAncestors(
    route,
    readCurriculumRoutes()
  ).filter(isRenderableCurriculumRoute);

  for (const ancestor of ancestors) {
    breadcrumbs.push({
      name: ancestor.title,
      path: `/${ancestor.publicPath}`,
    });
  }

  breadcrumbs.push({
    name: route.title,
    path: `/${route.publicPath}`,
  });

  return breadcrumbs;
}

/** Builds sidebar chapter links from rendered material cards. */
export function readMaterialCardChapters(cards: MaterialList): ParsedHeading[] {
  return cards.map((card) => ({
    children: [],
    href: `#${slugify(card.title)}`,
    label: card.title,
  }));
}

/** Checks whether a curriculum row should render the material-card index. */
function isMaterialCardListRoute(route: PublicCurriculumRoute) {
  return route.level === "subject" || route.level === "course";
}

/**
 * Groups sibling curriculum rows by source-owned stage labels.
 *
 * Root pages use these groups for SD/SMP/SMA or official pathway stages,
 * while child pages without a display group keep one unlabelled section.
 */
function groupCurriculumChildren(routes: readonly PublicCurriculumRoute[]) {
  const groups = new Map<string, PublicCurriculumRoute[]>();

  for (const route of routes) {
    const groupTitle = route.displayGroupTitle ?? "";
    groups.set(groupTitle, [...(groups.get(groupTitle) ?? []), route]);
  }

  return [...groups.entries()].map(([title, children]) => ({
    children,
    key: title || "curriculum",
    title: title || undefined,
  }));
}
