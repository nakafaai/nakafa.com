import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import { listPublicCurriculumRoutesEffect } from "@repo/contents/_types/route/projection";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
} from "@repo/contents/_types/route/schema";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";
import { Effect } from "effect";
import { notFound } from "next/navigation";
import { getCurriculumGradeIcon } from "@/app/[locale]/(app)/(shared)/(main)/(learn)/curricula/icons";
import {
  isMaterialLessonRoute,
  MATERIAL_ROUTES,
  type MaterialRoute,
  toLocalizedHref,
} from "@/app/[locale]/(app)/(shared)/(main)/(learn)/materials/[subject]/[topic]/[[...lesson]]/data";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type CurriculumParams =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">["params"];

export const CURRICULUM_ROUTES = Effect.runSync(
  listPublicCurriculumRoutesEffect()
);

/** Builds static params for rendered curriculum context pages only. */
export function listCurriculumStaticParams() {
  return CURRICULUM_ROUTES.filter(isRenderableCurriculumRoute).map((route) => {
    const [, curriculum, ...path] = route.publicPath.split("/");

    return path.length > 0 ? { curriculum, path } : { curriculum };
  });
}

/** Resolves localized curriculum params through projected route rows. */
export async function resolveCurriculumRoute(params: CurriculumParams) {
  const { locale: rawLocale, curriculum, path } = await params;
  const locale = getLocaleOrThrow(rawLocale);
  const routePath = [curriculum, ...(path ?? [])].join("/");
  const route = CURRICULUM_ROUTES.find(
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
  const childRoutes = CURRICULUM_ROUTES.filter(
    (child) => child.locale === locale && child.parentPath === route.publicPath
  );
  const isCurriculumRoot = route.level === "track";
  const materialCards = isCurriculumMaterialIndexRoute(route)
    ? readCurriculumMaterialCards(route)
    : [];
  const usesGradeCards =
    isCurriculumRoot &&
    childRoutes.length > 0 &&
    childRoutes.every(
      (childRoute) =>
        childRoute.level === "class" &&
        getCurriculumGradeIcon(childRoute.nodeKey) !== null
    );

  return {
    childRoutes,
    isCurriculumRoot,
    locale,
    materialCards,
    route,
    usesGradeCards,
  };
}

/** Builds the small parent link shown above curriculum page titles. */
export function readCurriculumHeaderLink(
  locale: PublicCurriculumRoute["locale"],
  route: PublicCurriculumRoute
) {
  if (!route.parentPath) {
    return;
  }

  const parent = readCurriculumRouteByPublicPath(locale, route.parentPath);

  if (!(parent && isRenderableCurriculumRoute(parent))) {
    return;
  }

  return {
    href: `/${locale}/${parent.publicPath}`,
    label: parent.title,
  };
}

/** Builds the right-sidebar header from the body parent context. */
export function readCurriculumTocHeader(
  locale: PublicCurriculumRoute["locale"],
  route: PublicCurriculumRoute
) {
  const parentLink = readCurriculumHeaderLink(locale, route);

  return {
    title: route.title,
    href: `/${locale}/${route.publicPath}`,
    description: parentLink?.label ?? route.description,
  };
}

/** Reads the projected breadcrumb chain for one curriculum page. */
export function readCurriculumBreadcrumbs(
  homeLabel: string,
  route: PublicCurriculumRoute
) {
  const breadcrumbs = [{ name: homeLabel, path: "" }];
  const ancestors = readCurriculumAncestors(route).filter(
    isRenderableCurriculumRoute
  );

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

/** Checks whether a curriculum route should render a public page. */
export function isRenderableCurriculumRoute(route: PublicCurriculumRoute) {
  return (
    route.level === "track" ||
    route.level === "class" ||
    route.level === "subject" ||
    route.level === "course"
  );
}

/** Removes the localized route namespace from one projected public path. */
function readPathWithoutNamespace(publicPath: string) {
  return publicPath.split("/").slice(1).join("/");
}

/** Checks whether a curriculum row should render the material-card index. */
function isCurriculumMaterialIndexRoute(route: PublicCurriculumRoute) {
  return route.level === "subject" || route.level === "course";
}

/** Converts subject/course mappings into the old collapsible material-card UX. */
function readCurriculumMaterialCards(
  route: PublicCurriculumRoute
): MaterialList {
  const groupRoutes = CURRICULUM_ROUTES.filter(
    (candidate) =>
      candidate.locale === route.locale &&
      candidate.parentPath === route.publicPath
  );

  return groupRoutes.flatMap((groupRoute) =>
    readCurriculumMaterialCard(groupRoute)
  );
}

/** Creates one material card from a curriculum grouping node. */
function readCurriculumMaterialCard(
  route: PublicCurriculumRoute
): MaterialList {
  const items = readCurriculumMaterialItems(route);

  if (items.length === 0) {
    return [];
  }

  return [
    {
      description: route.description,
      href: items[0]?.href ?? `/${route.locale}/${route.publicPath}`,
      items,
      title: route.title,
    },
  ];
}

/** Expands descendant curriculum mappings into concrete lesson links. */
function readCurriculumMaterialItems(route: PublicCurriculumRoute) {
  const materialItems = new Map<string, { href: string; title: string }>();

  for (const curriculumRoute of [route, ...readCurriculumDescendants(route)]) {
    if (!curriculumRoute.canonicalPath) {
      continue;
    }

    for (const item of readMaterialLessonItems(
      curriculumRoute.locale,
      curriculumRoute.canonicalPath
    )) {
      materialItems.set(item.href, item);
    }
  }

  return [...materialItems.values()];
}

/** Resolves one canonical material path into concrete lesson links. */
function readMaterialLessonItems(
  locale: PublicCurriculumRoute["locale"],
  path: string
) {
  const route = MATERIAL_ROUTES.find(
    (candidate) =>
      candidate.locale === locale &&
      candidate.publicPath === path &&
      isMaterialContentRoute(candidate)
  );

  if (!route) {
    return [];
  }

  if (isMaterialLessonRoute(route)) {
    return [{ href: toLocalizedHref(route), title: route.title }];
  }

  return MATERIAL_ROUTES.filter(isMaterialLessonRoute)
    .filter(
      (candidate) =>
        candidate.locale === locale && candidate.parentPath === route.publicPath
    )
    .map((candidate) => ({
      href: toLocalizedHref(candidate),
      title: candidate.title,
    }));
}

/** Narrows projected content routes to reusable lesson material rows. */
function isMaterialContentRoute(
  route: PublicContentRoute
): route is MaterialRoute {
  return route.kind === "subject-topic" || route.kind === "subject-lesson";
}

/** Reads visible projected ancestors without reconstructing URL segments. */
function readCurriculumAncestors(route: PublicCurriculumRoute) {
  const ancestors: PublicCurriculumRoute[] = [];
  let parentPath = route.parentPath;

  while (parentPath) {
    const parent = readCurriculumRouteByPublicPath(route.locale, parentPath);

    if (!parent) {
      break;
    }

    ancestors.unshift(parent);
    parentPath = parent.parentPath;
  }

  return ancestors;
}

/** Reads all projected descendants for one curriculum route in route order. */
function readCurriculumDescendants(route: PublicCurriculumRoute) {
  const descendants: PublicCurriculumRoute[] = [];
  const childRoutes = CURRICULUM_ROUTES.filter(
    (candidate) =>
      candidate.locale === route.locale &&
      candidate.parentPath === route.publicPath
  );

  for (const child of childRoutes) {
    descendants.push(child);
    descendants.push(...readCurriculumDescendants(child));
  }

  return descendants;
}

/** Looks up one curriculum route by projected public path. */
function readCurriculumRouteByPublicPath(
  locale: PublicCurriculumRoute["locale"],
  publicPath: PublicCurriculumRoute["publicPath"]
) {
  return CURRICULUM_ROUTES.find(
    (candidate) =>
      candidate.locale === locale && candidate.publicPath === publicPath
  );
}
