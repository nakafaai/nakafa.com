"use client";

import dynamic from "next/dynamic";

export const Set2Question19Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-2/question-19"
  ).then(({ Graph }) => Graph)
);

export const Set2Question6Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-2/question-6"
  ).then(({ Graph }) => Graph)
);
