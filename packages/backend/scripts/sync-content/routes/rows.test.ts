import {
  buildPublicRouteProjection,
  readPublicRouteProjection,
} from "@repo/backend/scripts/sync-content/routes/rows";
import { listPublicRoutes } from "@repo/contents/_types/route/projection";
import type {
  PublicCurriculumRoute,
  PublicRoute,
} from "@repo/contents/_types/route/schema";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

type OwnedMaterialContextRoute = PublicCurriculumRoute &
  Required<
    Pick<
      PublicCurriculumRoute,
      | "materialContextNodeKey"
      | "materialContextParentPath"
      | "materialContextPublicPath"
      | "materialKey"
      | "programKey"
    >
  >;

/** Narrows source routes to fully owned curriculum material placements. */
function isOwnedMaterialContextRoute(
  route: PublicRoute
): route is OwnedMaterialContextRoute {
  if (route.kind !== "curriculum-context") {
    return false;
  }

  return Boolean(
    route.materialKey &&
      route.programKey &&
      route.materialContextNodeKey &&
      route.materialContextParentPath &&
      route.materialContextPublicPath
  );
}

describe("sync-content/routes/rows", () => {
  it("serializes explicit material-context ownership into Convex shards", async () => {
    const projection = await Effect.runPromise(readPublicRouteProjection());
    const route = projection.shards
      .flatMap((shard) => shard.routes)
      .find(
        (candidate) =>
          candidate.locale === "id" &&
          candidate.nodeKey ===
            "class-10-mathematics-linear-equation-inequality-material"
      );

    expect(route).toMatchObject({
      materialContextNodeKey: "class-10-mathematics-linear-equation-inequality",
      materialContextParentPath: "kurikulum/merdeka/kelas-10/matematika",
      materialContextPublicPath:
        "kurikulum/merdeka/kelas-10/matematika/sistem-persamaan-dan-pertidaksamaan-linear",
    });
  });

  it("rejects duplicate exact material-context identities before sync", async () => {
    const sourceRoutes = await Effect.runPromise(listPublicRoutes());
    const placementRoutes = sourceRoutes.filter(isOwnedMaterialContextRoute);
    const first = placementRoutes.at(0);
    const second = placementRoutes.find(
      (route) => route.publicPath !== first?.publicPath
    );

    if (!(first && second)) {
      expect.fail("Expected at least two material placement routes.");
    }

    const duplicate = {
      ...second,
      materialContextNodeKey: first.materialContextNodeKey,
      materialContextParentPath: first.materialContextParentPath,
      materialContextPublicPath: first.materialContextPublicPath,
      materialKey: first.materialKey,
      programKey: first.programKey,
    };

    const failure = await Effect.runPromise(
      Effect.flip(buildPublicRouteProjection([first, duplicate]))
    );

    expect(failure).toMatchObject({
      _tag: "PublicRouteProjectionError",
      message: expect.stringContaining("Duplicate material context identity"),
    });
  });

  it("rejects duplicate routes and incomplete material ownership", async () => {
    const sourceRoutes = await Effect.runPromise(listPublicRoutes());
    const placement = sourceRoutes.find(isOwnedMaterialContextRoute);

    if (!placement) {
      expect.fail("Expected a material placement route.");
    }

    const duplicateRouteFailure = await Effect.runPromise(
      Effect.flip(buildPublicRouteProjection([placement, placement]))
    );
    const incompleteOwnershipFailure = await Effect.runPromise(
      Effect.flip(
        buildPublicRouteProjection([
          { ...placement, materialContextPublicPath: undefined },
        ])
      )
    );
    const missingOwnershipFailure = await Effect.runPromise(
      Effect.flip(
        buildPublicRouteProjection([
          {
            ...placement,
            materialContextNodeKey: undefined,
            materialContextParentPath: undefined,
            materialContextPublicPath: undefined,
          },
        ])
      )
    );

    expect(duplicateRouteFailure).toMatchObject({
      _tag: "PublicRouteProjectionError",
      message: expect.stringContaining("Duplicate public route identity"),
    });
    expect(incompleteOwnershipFailure).toMatchObject({
      _tag: "PublicRouteProjectionError",
      message: expect.stringContaining("Incomplete material context ownership"),
    });
    expect(missingOwnershipFailure).toMatchObject({
      _tag: "PublicRouteProjectionError",
      message: expect.stringContaining("Incomplete material context ownership"),
    });
  });
});
