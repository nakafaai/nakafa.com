import {
  type MaterialList,
  MaterialListSchema,
} from "@repo/contents/_types/curriculum/material";
import {
  isMaterialContentRoute,
  isMaterialLessonRoute,
  toLocalizedContentHref,
} from "@repo/contents/_types/route/content";
import {
  compareCurriculumRouteOrder,
  readCurriculumRouteByPublicPath,
} from "@repo/contents/_types/route/curriculum";
import {
  createMaterialContextIndex,
  type MaterialContextIndex,
} from "@repo/contents/_types/route/learning/context";
import { comparePublicRouteOrder } from "@repo/contents/_types/route/path";
import type {
  PublicContentRoute,
  PublicCurriculumRoute,
} from "@repo/contents/_types/route/schema";
import { Schema } from "effect";

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
  route,
}: {
  contentRoutes: readonly PublicContentRoute[];
  curriculumRoutes: readonly PublicCurriculumRoute[];
  route: PublicCurriculumRoute;
}): MaterialList {
  if (!(route.level === "subject" || route.level === "course")) {
    return [];
  }

  const materialContextIndex = createMaterialContextIndex({
    contentRoutes,
    curriculumRoutes,
  });
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
      materialContextIndex,
      route: groupRoute,
    })
  );
}

/** Converts one curriculum group route into the existing collapsible material card contract. */
function readCurriculumMaterialCard({
  contentRoutes,
  curriculumRoutes,
  materialContextIndex,
  route,
}: {
  contentRoutes: readonly PublicContentRoute[];
  curriculumRoutes: readonly PublicCurriculumRoute[];
  materialContextIndex: MaterialContextIndex;
  route: PublicCurriculumRoute;
}): MaterialList {
  const items = readCurriculumMaterialItems({
    contentRoutes,
    curriculumRoutes,
    materialContextIndex,
    route,
  });

  if (items.length === 0) {
    return [];
  }

  return Schema.decodeUnknownSync(MaterialListSchema)([
    {
      description: route.materialCardDescription,
      href: items[0].href,
      items,
      title: route.materialCardTitle,
    },
  ]);
}

/** Expands a curriculum group and its descendants into direct canonical lesson links. */
function readCurriculumMaterialItems({
  contentRoutes,
  curriculumRoutes,
  materialContextIndex,
  route,
}: {
  contentRoutes: readonly PublicContentRoute[];
  curriculumRoutes: readonly PublicCurriculumRoute[];
  materialContextIndex: MaterialContextIndex;
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
      contentRoutes,
      materialContextIndex,
      route
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
  contentRoutes: readonly PublicContentRoute[],
  materialContextIndex: MaterialContextIndex,
  contextRoute: PublicCurriculumRoute
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
    return [toMaterialLessonItem(route, materialContextIndex, contextRoute)];
  }

  return contentRoutes
    .filter(isMaterialLessonRoute)
    .filter(
      (candidate) =>
        candidate.locale === locale && candidate.parentPath === route.publicPath
    )
    .slice()
    .sort(comparePublicRouteOrder)
    .map((candidate) =>
      toMaterialLessonItem(candidate, materialContextIndex, contextRoute)
    );
}

/** Builds one direct lesson item with a validated curriculum context hint. */
function toMaterialLessonItem(
  route: PublicContentRoute,
  materialContextIndex: MaterialContextIndex,
  contextRoute: PublicCurriculumRoute
) {
  return {
    href: materialContextIndex.toContextualHref({
      contextRoute,
      href: toLocalizedContentHref(route),
      route,
    }),
    title: route.title,
  };
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
