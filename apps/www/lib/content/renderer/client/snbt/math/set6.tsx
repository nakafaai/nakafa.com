"use client";

import dynamic from "next/dynamic";

export const Set6Question18Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-6/question-18"
  ).then(({ Graph }) => Graph)
);

export const Set6Question19Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-6/question-19"
  ).then(({ Graph }) => Graph)
);

export const Set6Question5Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-6/question-5"
  ).then(({ Graph }) => Graph)
);
