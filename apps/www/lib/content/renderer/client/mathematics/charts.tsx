"use client";

import dynamic from "next/dynamic";

export const BarChart = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/bar-chart").then(
    ({ BarChart }) => BarChart
  )
);

export const HistogramChart = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/bar-chart").then(
    ({ HistogramChart }) => HistogramChart
  )
);

export const FunctionChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/function-chart"
  ).then(({ FunctionChart }) => FunctionChart)
);

export const ScatterDiagram = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/scatter-diagram"
  ).then(({ ScatterDiagram }) => ScatterDiagram)
);

export const VectorChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/vector-chart"
  ).then(({ VectorChart }) => VectorChart)
);
