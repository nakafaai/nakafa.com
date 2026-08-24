"use client";

import dynamic from "next/dynamic";

export const Set1Question19Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/tka/mathematics/set-1/question-19"
  ).then(({ Graph }) => Graph)
);

export const Set1Question30Illustration = dynamic(() =>
  import(
    "@repo/design-system/components/contents/tka/mathematics/set-1/question-30"
  ).then(({ Illustration }) => Illustration)
);
