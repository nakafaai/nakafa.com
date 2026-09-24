"use client";

import dynamic from "next/dynamic";

export const LineEquation = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/line/equation"
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

/** Preserves signed dev answers while their successor publication is staged. */
export const Set1Question19Graph = dynamic(() =>
  import("@repo/design-system/components/contents/tka/mathematics/sine").then(
    ({ Graph }) => Graph
  )
);

/** Preserves the signed fence illustration through the paired corpus migration. */
export const Set1Question30Illustration = dynamic(() =>
  import("@repo/design-system/components/contents/tka/mathematics/fence").then(
    ({ Illustration }) => Illustration
  )
);
