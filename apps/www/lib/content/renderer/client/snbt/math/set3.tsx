"use client";

import dynamic from "next/dynamic";

export const Set3Question18Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-3/question-18"
  ).then(({ Graph }) => Graph)
);

export const Set3Question18GraphSolution = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-3/question-18/solution"
  ).then(({ GraphSolution }) => GraphSolution)
);

export const Set3Question19Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-3/question-19"
  ).then(({ Graph }) => Graph)
);
