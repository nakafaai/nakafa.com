"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BarChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/bar-chart"
    ).then((module) => ({ default: module.BarChart }))
  )
);

export const HistogramChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/bar-chart"
    ).then((module) => ({ default: module.HistogramChart }))
  )
);

export const ScatterDiagram = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/scatter-diagram"
    ).then((module) => ({ default: module.ScatterDiagram }))
  )
);

export const VectorChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/vector-chart"
    ).then((module) => ({ default: module.VectorChart }))
  )
);
