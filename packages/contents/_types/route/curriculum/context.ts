import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";

/** Source-owned curriculum context that presents one material mapping. */
export interface CurriculumMaterialContext {
  groupRoute: PublicCurriculumRoute;
  parentRoute: PublicCurriculumRoute;
}

/**
 * Resolves the card group and card-list parent that present one material route.
 *
 * Material mappings may be direct card children or nested below a grouping
 * node. The closest descendant of a subject/course is the stable context
 * identity shared by material links and the durable public-route projection.
 */
export function readCurriculumMaterialContext(
  route: PublicCurriculumRoute,
  routes: readonly PublicCurriculumRoute[]
): CurriculumMaterialContext | undefined {
  let current: PublicCurriculumRoute | undefined = route;

  while (current?.parentPath) {
    const parent = routes.find(
      (candidate) =>
        candidate.locale === current?.locale &&
        candidate.publicPath === current?.parentPath
    );

    if (!parent) {
      return;
    }

    if (parent.level === "subject" || parent.level === "course") {
      return {
        groupRoute: current,
        parentRoute: parent,
      };
    }

    current = parent;
  }

  return;
}

/** Adds explicit material-context ownership to every mapped curriculum leaf. */
export function addCurriculumMaterialContextOwnership(
  routes: readonly PublicCurriculumRoute[]
) {
  return routes.map((route) => {
    if (!route.materialKey) {
      return route;
    }

    const context = readCurriculumMaterialContext(route, routes);

    if (!context) {
      return route;
    }

    return {
      ...route,
      materialContextNodeKey: context.groupRoute.nodeKey,
      materialContextParentPath: context.parentRoute.publicPath,
      materialContextPublicPath: context.groupRoute.publicPath,
    };
  });
}
