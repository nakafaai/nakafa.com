import { listPublicCurriculumRoutes } from "@repo/contents/_types/route/curriculum";
import {
  addCurriculumMaterialContextOwnership,
  readCurriculumMaterialContext,
} from "@repo/contents/_types/route/curriculum/context";
import type { PublicCurriculumRoute } from "@repo/contents/_types/route/schema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("curriculum material context", () => {
  it("owns each material leaf through its nearest card group", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());
    const materialRoute = routes.find(
      (route) =>
        route.locale === "id" &&
        route.nodeKey ===
          "class-10-mathematics-linear-equation-inequality-material"
    );

    expect(materialRoute).toBeDefined();
    expect(
      routes
        .filter((route) => route.materialKey)
        .every(
          (route) =>
            route.materialContextNodeKey &&
            route.materialContextParentPath &&
            route.materialContextPublicPath
        )
    ).toBe(true);

    if (!materialRoute) {
      return;
    }

    const context = readCurriculumMaterialContext(materialRoute, routes);

    expect(context?.groupRoute.nodeKey).toBe(
      "class-10-mathematics-linear-equation-inequality"
    );
    expect(context?.parentRoute.publicPath).toBe(
      "kurikulum/merdeka/kelas-10/matematika"
    );

    const ownedRoute = addCurriculumMaterialContextOwnership(routes).find(
      (route) => route.publicPath === materialRoute.publicPath
    );

    expect(ownedRoute).toMatchObject({
      materialContextNodeKey: "class-10-mathematics-linear-equation-inequality",
      materialContextParentPath: "kurikulum/merdeka/kelas-10/matematika",
      materialContextPublicPath:
        "kurikulum/merdeka/kelas-10/matematika/sistem-persamaan-dan-pertidaksamaan-linear",
    });
  });

  it("leaves detached and non-material routes unchanged", () => {
    const routes = Effect.runSync(listPublicCurriculumRoutes());
    const materialRoute = routes.find(
      (route) =>
        route.locale === "id" &&
        route.nodeKey ===
          "class-10-mathematics-linear-equation-inequality-material"
    );
    const rootRoute = routes.find(
      (route) =>
        route.locale === "id" && route.publicPath === "kurikulum/merdeka"
    );

    expect(materialRoute).toBeDefined();
    expect(rootRoute).toBeDefined();

    if (!(materialRoute && rootRoute)) {
      return;
    }

    const detachedRoute: PublicCurriculumRoute = {
      ...materialRoute,
      parentPath: undefined,
    };

    expect(
      readCurriculumMaterialContext(materialRoute, [materialRoute])
    ).toBeUndefined();
    expect(
      readCurriculumMaterialContext(detachedRoute, routes)
    ).toBeUndefined();
    expect(addCurriculumMaterialContextOwnership([detachedRoute])).toEqual([
      detachedRoute,
    ]);
    expect(addCurriculumMaterialContextOwnership([rootRoute])).toEqual([
      rootRoute,
    ]);
  });
});
