"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NumberLine = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/number-line"
    ).then((module) => ({ default: module.NumberLine }))
  )
);

export const HistogramChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/bar-chart"
    ).then((module) => ({ default: module.HistogramChart }))
  )
);
