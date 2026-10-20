"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BarChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/bar-chart"
    ).then(({ BarChart }) => BarChart)
  )
);

export const HistogramChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/bar-chart"
    ).then(({ HistogramChart }) => HistogramChart)
  )
);

export const ScatterDiagram = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/scatter-diagram"
    ).then(({ ScatterDiagram }) => ScatterDiagram)
  )
);

export const VectorChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/vector-chart"
    ).then(({ VectorChart }) => VectorChart)
  )
);
