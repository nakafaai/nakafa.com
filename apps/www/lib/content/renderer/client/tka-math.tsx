"use client";

import dynamic from "next/dynamic";

export const LazyHistogramChart = dynamic(() =>
  import("@repo/design-system/components/contents/mathematics/bar-chart").then(
    ({ HistogramChart }) => HistogramChart
  )
);
export const LazySet1Question19Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/tka/mathematics/set-1/question-19"
  ).then(({ Graph }) => Graph)
);
