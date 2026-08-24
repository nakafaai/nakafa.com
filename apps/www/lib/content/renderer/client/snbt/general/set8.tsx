"use client";

import dynamic from "next/dynamic";

export const Set8Question17ProfitChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-8/question-17"
  ).then(({ ProfitChart }) => ProfitChart)
);

export const Set8Question1SalesChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-8/question-1"
  ).then(({ SalesChart }) => SalesChart)
);
