"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const LineEquation = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/line/equation"
    ).then(({ LineEquation: Component }) => Component)
  )
);

export const NumberLine = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/number-line"
    ).then(({ NumberLine: Component }) => Component)
  )
);

export const HistogramChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/mathematics/bar-chart"
    ).then(({ HistogramChart }) => HistogramChart)
  )
);
