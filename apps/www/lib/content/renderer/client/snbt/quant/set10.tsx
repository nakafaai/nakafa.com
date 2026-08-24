"use client";

import dynamic from "next/dynamic";

export const Set10Question1Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-10/question-1"
  ).then(({ Graph }) => Graph)
);

export const Set10Question2Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-10/question-2"
  ).then(({ Graph }) => Graph)
);

export const Set10Question8Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-10/question-8"
  ).then(({ Graph }) => Graph)
);
