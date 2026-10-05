"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BarChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/bar-chart"
    ).then(({ BarChart }) => BarChart)
  )
);

export const HistogramChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/bar-chart"
    ).then(({ HistogramChart }) => HistogramChart)
  )
);

export const ScatterDiagram = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/scatter-diagram"
    ).then(({ ScatterDiagram }) => ScatterDiagram)
  )
);

export const VectorChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/vector-chart"
    ).then(({ VectorChart }) => VectorChart)
  )
);
