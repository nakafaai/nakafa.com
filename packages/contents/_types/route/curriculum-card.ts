import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import type { MaterialSource } from "@repo/contents/_types/material/schema";
import { MATERIAL_SOURCES } from "@repo/contents/_types/material/source";
import {
  isMaterialContentRoute,
  isMaterialLessonRoute,
  toLocalizedContentHref,
} from "@repo/contents/_types/route/content";
import {
  compareCurriculumRouteOrder,
  readCurriculumRouteByPublicPath,
} from "@repo/contents/_types/route/curriculum";
import { comparePublicRouteOrder } from "@repo/contents/_types/route/path";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
} from "@repo/contents/_types/route/schema";

/** Reads the closest subject/course context that renders material cards. */
export function readCurriculumCardListContext(
  route: PublicCurriculumRoute,
  routes: readonly PublicCurriculumRoute[]
): PublicCurriculumRoute | undefined {
  if (route.level === "subject" || route.level === "course") {
    return route;
  }

  if (!route.parentPath) {
    return;
  }

  const parent = readCurriculumRouteByPublicPath(
    routes,
    route.locale,
    route.parentPath
  );

  if (!parent) {
    return;
  }

  return readCurriculumCardListContext(parent, routes);
}

/** Converts subject/course mappings into the established collapsible card model. */
export function readCurriculumMaterialCards({
  contentRoutes,
  curriculumRoutes,
  materials = MATERIAL_SOURCES,
  route,
}: {
  contentRoutes: readonly PublicContentRoute[];
  curriculumRoutes: readonly PublicCurriculumRoute[];
  materials?: readonly MaterialSource[];
  route: PublicCurriculumRoute;
}): MaterialList {
  const groupRoutes = curriculumRoutes
    .filter(
      (candidate) =>
        candidate.locale === route.locale &&
        candidate.parentPath === route.publicPath
    )
    .slice()
    .sort(compareCurriculumRouteOrder);

  return groupRoutes.flatMap((groupRoute) =>
    readCurriculumMaterialCard({
      contentRoutes,
      curriculumRoutes,
      materials,
      route: groupRoute,
    })
  );
}

/** Converts one curriculum group route into the existing collapsible material card contract. */
function readCurriculumMaterialCard({
  contentRoutes,
  curriculumRoutes,
  materials,
  route,
}: {
  contentRoutes: readonly PublicContentRoute[];
  curriculumRoutes: readonly PublicCurriculumRoute[];
  materials: readonly MaterialSource[];
  route: PublicCurriculumRoute;
}): MaterialList {
  const items = readCurriculumMaterialItems({
    contentRoutes,
    curriculumRoutes,
    route,
  });

  if (items.length === 0) {
    return [];
  }

  const description = readCurriculumMaterialCardDescription({
    curriculumRoutes,
    materials,
    route,
  });

  return [
    {
      ...(description ? { description } : {}),
      href: items[0].href,
      items,
      title: route.title,
    },
  ];
}

/** Reads source-owned material copy when a card represents exactly one material. */
function readCurriculumMaterialCardDescription({
  curriculumRoutes,
  materials,
  route,
}: {
  curriculumRoutes: readonly PublicCurriculumRoute[];
  materials: readonly MaterialSource[];
  route: PublicCurriculumRoute;
}) {
  const materialKeys = readCurriculumMaterialKeys(route, curriculumRoutes);

  if (materialKeys.size !== 1) {
    return;
  }

  const materialKey = [...materialKeys][0];
  const material = materials.find((candidate) => candidate.key === materialKey);

  if (material?.kind !== "lesson") {
    return;
  }

  return material.translations[route.locale].description;
}

/** Collects mapped material keys for a card route and its projected descendants. */
function readCurriculumMaterialKeys(
  route: PublicCurriculumRoute,
  routes: readonly PublicCurriculumRoute[]
) {
  const materialKeys = new Set<string>();

  for (const curriculumRoute of [
    route,
    ...readCurriculumDescendants(route, routes),
  ]) {
    if (!curriculumRoute.materialKey) {
      continue;
    }

    materialKeys.add(curriculumRoute.materialKey);
  }

  return materialKeys;
}

/** Expands a curriculum group and its descendants into direct canonical lesson links. */
function readCurriculumMaterialItems({
  contentRoutes,
  curriculumRoutes,
  route,
}: {
  contentRoutes: readonly PublicContentRoute[];
  curriculumRoutes: readonly PublicCurriculumRoute[];
  route: PublicCurriculumRoute;
}) {
  const materialItems = new Map<string, { href: string; title: string }>();

  for (const curriculumRoute of [
    route,
    ...readCurriculumDescendants(route, curriculumRoutes),
  ]) {
    if (!curriculumRoute.canonicalPath) {
      continue;
    }

    for (const item of readMaterialLessonItems(
      curriculumRoute.locale,
      curriculumRoute.canonicalPath,
      contentRoutes
    )) {
      materialItems.set(item.href, item);
    }
  }

  return [...materialItems.values()];
}

/** Reads canonical lesson links from a projected material topic or concrete lesson route. */
function readMaterialLessonItems(
  locale: PublicCurriculumRoute["locale"],
  path: string,
  contentRoutes: readonly PublicContentRoute[]
) {
  const route = contentRoutes.find(
    (candidate) =>
      candidate.locale === locale &&
      candidate.publicPath === path &&
      isMaterialContentRoute(candidate)
  );

  if (!route) {
    return [];
  }

  if (isMaterialLessonRoute(route)) {
    return [{ href: toLocalizedContentHref(route), title: route.title }];
  }

  return contentRoutes
    .filter(isMaterialLessonRoute)
    .filter(
      (candidate) =>
        candidate.locale === locale && candidate.parentPath === route.publicPath
    )
    .slice()
    .sort(comparePublicRouteOrder)
    .map((candidate) => ({
      href: toLocalizedContentHref(candidate),
      title: candidate.title,
    }));
}

/** Walks visible curriculum descendants in source order so card lists stay deterministic. */
function readCurriculumDescendants(
  route: PublicCurriculumRoute,
  routes: readonly PublicCurriculumRoute[]
) {
  const descendants: PublicCurriculumRoute[] = [];
  const childRoutes = routes
    .filter(
      (candidate) =>
        candidate.locale === route.locale &&
        candidate.parentPath === route.publicPath
    )
    .slice()
    .sort(compareCurriculumRouteOrder);

  for (const child of childRoutes) {
    descendants.push(child);
    descendants.push(...readCurriculumDescendants(child, routes));
  }

  return descendants;
}
