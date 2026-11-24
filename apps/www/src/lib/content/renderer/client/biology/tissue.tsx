"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const PlantGrowthCurveLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/growth/lab").then(
      (module) => ({ default: module.PlantGrowthCurveLab })
    )
  )
);

export const PlantTissueAnatomyLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/tissue/lab").then(
      (module) => ({ default: module.PlantTissueAnatomyLab })
    )
  )
);

export const RootShootGrowthZoneLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/meristem/lab").then(
      (module) => ({ default: module.RootShootGrowthZoneLab })
    )
  )
);
