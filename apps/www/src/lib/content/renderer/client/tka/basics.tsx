"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const LineEquation = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/line/equation"
    ).then((module) => ({ default: module.LineEquation }))
  )
);

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
