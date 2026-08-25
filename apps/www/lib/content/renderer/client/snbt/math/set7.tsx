"use client";

import dynamic from "next/dynamic";

export const Set7Question18Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-7/question-18"
  ).then(({ Graph }) => Graph)
);

export const Set7Question19Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-7/question-19"
  ).then(({ Graph }) => Graph)
);

export const Set7Question4Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/mathematics/set-7/question-4"
  ).then(({ Graph }) => Graph)
);
