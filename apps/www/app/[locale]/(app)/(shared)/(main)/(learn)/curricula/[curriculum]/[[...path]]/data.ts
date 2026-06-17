import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import { listPublicContentRoutes } from "@repo/contents/_types/route/content";
import {
  compareCurriculumRouteOrder,
  isRenderableCurriculumRoute,
  listPublicCurriculumRoutes,
  readCurriculumAncestors,
  readCurriculumMaterialCards,
  readCurriculumRouteByPublicPath,
} from "@repo/contents/_types/route/curriculum";
import { readPathWithoutNamespace } from "@repo/contents/_types/route/path";
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import type { ParsedHeading } from "@repo/contents/_types/toc";
import { slugify } from "@repo/design-system/lib/utils";
import { Effect } from "effect";
import { notFound } from "next/navigation";
import { getLocaleOrThrow } from "@/lib/i18n/params";

type CurriculumParams =
  PageProps<"/[locale]/curricula/[curriculum]/[[...path]]">["params"];

export const CURRICULUM_ROUTES = Effect.runSync(listPublicCurriculumRoutes());
const MATERIAL_ROUTES = Effect.runSync(listPublicContentRoutes());

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
  )
    .filter(isRenderableCurriculumRoute)
    .slice()
    .sort(compareCurriculumRouteOrder);
  const materialCards = isMaterialCardListRoute(route)
    ? readCurriculumMaterialCards({
        contentRoutes: MATERIAL_ROUTES,
        curriculumRoutes: CURRICULUM_ROUTES,
        route,
      })
    : [];
  const childGroups = groupCurriculumChildren(childRoutes);
  const headerDescription =
    materialCards.length > 0 ? undefined : route.description;

  return {
    childGroups,
    childRoutes,
    headerDescription,
    locale,
    materialCards,
    route,
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

  const parent = readCurriculumRouteByPublicPath(
    CURRICULUM_ROUTES,
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
  const ancestors = readCurriculumAncestors(route, CURRICULUM_ROUTES).filter(
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
    iconKey: children.find((child) => child.displayGroupIconKey)
      ?.displayGroupIconKey,
    key: title || "curriculum",
    title: title || undefined,
  }));
}
