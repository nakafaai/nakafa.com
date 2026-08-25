"use client";

import dynamic from "next/dynamic";

export const Set9Question1Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-9/question-1"
  ).then(({ Graph }) => Graph)
);

export const Set9Question2Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-9/question-2"
  ).then(({ Graph }) => Graph)
);

export const Set9Question3Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-9/question-3"
  ).then(({ Graph }) => Graph)
);
