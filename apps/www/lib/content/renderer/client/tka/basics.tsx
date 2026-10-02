"use client";

import dynamic from "next/dynamic";

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
