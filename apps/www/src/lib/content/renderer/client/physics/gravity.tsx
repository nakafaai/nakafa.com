"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const KeplerOrbitPeriodLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/physics/kepler/lab").then(
      (module) => ({ default: module.KeplerOrbitPeriodLab })
    )
  )
);

export const OrbitRadiusLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/gravity/orbit/lab"
    ).then((module) => ({ default: module.OrbitRadiusLab }))
  )
);

export const PlanetCompareLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/gravity/planet/lab"
    ).then((module) => ({ default: module.PlanetCompareLab }))
  )
);
