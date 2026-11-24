"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const CatalystPathwayLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/catalyst/lab"
    ).then((module) => ({ default: module.CatalystPathwayLab }))
  )
);

export const CollisionTheoryEnergyLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/collision/lab"
    ).then((module) => ({ default: module.CollisionTheoryEnergyLab }))
  )
);
