"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BacterialGrowth = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/animation-bacterial"
    ).then(({ BacterialGrowth }) => BacterialGrowth)
  )
);

export const FunctionExplorationVirusChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/exponential/virus-chart"
    ).then(({ VirusChart }) => VirusChart)
  )
);
