"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const LineEquation = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/line/equation"
      ).then(({ LineEquation: Component }) => Component))(),
  }))
);

export const NumberLine = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/number-line"
      ).then(({ NumberLine: Component }) => Component))(),
  }))
);

export const HistogramChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/bar-chart"
      ).then(({ HistogramChart }) => HistogramChart))(),
  }))
);
