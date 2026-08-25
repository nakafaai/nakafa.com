"use client";

import dynamic from "next/dynamic";

export const LineEquation = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/line-equation"
  ).then(({ LineEquation: Component }) => Component)
);

export const NumberLine = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/number-line"
  ).then(({ NumberLine: Component }) => Component)
);

export const HistogramChart = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/bar-chart").then(
    ({ HistogramChart }) => HistogramChart
  )
);
