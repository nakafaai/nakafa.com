"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const CarnivorousPlantLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/carnivore/lab"
    ).then((module) => ({ default: module.CarnivorousPlantLab }))
  )
);

export const MineralDeficiencyLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/mineral/lab").then(
      (module) => ({ default: module.MineralDeficiencyLab })
    )
  )
);

export const RootHairUptakeLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/root/lab").then(
      (module) => ({ default: module.RootHairUptakeLab })
    )
  )
);
