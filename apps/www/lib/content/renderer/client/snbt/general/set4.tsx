"use client";

import dynamic from "next/dynamic";

export const Set4Question14PriceChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-4/question-14"
  ).then(({ PriceChart }) => PriceChart)
);
