"use client";

import dynamic from "next/dynamic";

export const Set6Question12Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-6/question-12"
  ).then(({ Graph }) => Graph)
);

export const Set6Question19Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-6/question-19"
  ).then(({ Graph }) => Graph)
);
