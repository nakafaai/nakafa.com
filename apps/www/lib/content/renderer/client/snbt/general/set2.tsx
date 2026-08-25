"use client";

import dynamic from "next/dynamic";

export const Set2Question15SalesChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-2/question-15"
  ).then(({ SalesChart }) => SalesChart)
);

export const Set2Question5SalesChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-2/question-5"
  ).then(({ SalesChart }) => SalesChart)
);
