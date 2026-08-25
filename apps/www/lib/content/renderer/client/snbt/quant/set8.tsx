"use client";

import dynamic from "next/dynamic";

export const Set8Question20Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-8/question-20"
  ).then(({ Graph }) => Graph)
);
