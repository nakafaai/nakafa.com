"use client";

import dynamic from "next/dynamic";

export const Set4Question18Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-4/question-18"
  ).then(({ Graph }) => Graph)
);

export const Set4Question19Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-4/question-19"
  ).then(({ Graph }) => Graph)
);

export const Set4Question4Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-4/question-4"
  ).then(({ Graph }) => Graph)
);

export const Set4Question5Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-4/question-5"
  ).then(({ Graph }) => Graph)
);
