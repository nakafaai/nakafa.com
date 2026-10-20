"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BacterialGrowth = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/animation-bacterial"
    ).then((module) => ({ default: module.BacterialGrowth }))
  )
);

export const FunctionExplorationVirusChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/exponential/virus-chart"
    ).then((module) => ({ default: module.VirusChart }))
  )
);
