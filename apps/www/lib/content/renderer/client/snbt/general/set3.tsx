"use client";

import dynamic from "next/dynamic";

export const Set3Question14SpiceSalesChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-3/question-14"
  ).then(({ SpiceSalesChart }) => SpiceSalesChart)
);
