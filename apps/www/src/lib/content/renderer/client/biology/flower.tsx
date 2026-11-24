"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const FlowerAnatomyLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/flower/lab").then(
      (module) => ({ default: module.FlowerAnatomyLab })
    )
  )
);

export const FruitSeedDispersalLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/fruit/lab").then(
      (module) => ({ default: module.FruitSeedDispersalLab })
    )
  )
);
