"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BacterialGrowth = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/animation-bacterial"
    ).then(({ BacterialGrowth }) => BacterialGrowth)
  )
);

export const FunctionExplorationVirusChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/exponential/virus-chart"
    ).then(({ VirusChart }) => VirusChart)
  )
);
