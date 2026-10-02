"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const LineEquation = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/line/equation"
    ).then(({ LineEquation: Component }) => Component)
  )
);

export const NumberLine = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/number-line"
    ).then(({ NumberLine: Component }) => Component)
  )
);

export const HistogramChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/mathematics/bar-chart"
    ).then(({ HistogramChart }) => HistogramChart)
  )
);
