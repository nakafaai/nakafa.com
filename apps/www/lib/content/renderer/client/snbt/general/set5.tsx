"use client";

import dynamic from "next/dynamic";

export const Set5Question18GrowthChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-5/question-18"
  ).then(({ GrowthChart }) => GrowthChart)
);

export const Set5Question6SalesChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-5/question-6"
  ).then(({ SalesChart }) => SalesChart)
);
