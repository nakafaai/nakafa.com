"use client";

import dynamic from "next/dynamic";

export const BacterialGrowth = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/animation-bacterial"
  ).then(({ BacterialGrowth }) => BacterialGrowth)
);

export const FunctionExplorationVirusChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/mathematics/exponential/virus-chart"
  ).then(({ VirusChart }) => VirusChart)
);
