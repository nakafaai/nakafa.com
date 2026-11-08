"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BacterialGrowth = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/bacterial/animation"
    ).then((module) => ({ default: module.BacterialGrowth }))
  )
);

export const FunctionExplorationVirusChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/exponential/virus"
    ).then((module) => ({ default: module.VirusChart }))
  )
);
