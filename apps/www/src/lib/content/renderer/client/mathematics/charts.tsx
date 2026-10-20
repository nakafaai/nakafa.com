"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BarChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/bar-chart"
      ).then(({ BarChart }) => BarChart))(),
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

export const ScatterDiagram = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/scatter-diagram"
      ).then(({ ScatterDiagram }) => ScatterDiagram))(),
  }))
);

export const VectorChart = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/mathematics/vector-chart"
      ).then(({ VectorChart }) => VectorChart))(),
  }))
);
