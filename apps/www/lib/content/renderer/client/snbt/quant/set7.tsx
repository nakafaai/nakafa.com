"use client";

import dynamic from "next/dynamic";

export const Set7Question1Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-7/question-1"
  ).then(({ Graph }) => Graph)
);

export const Set7Question13Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-7/question-13"
  ).then(({ Graph }) => Graph)
);

export const Set7Question14Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-7/question-14"
  ).then(({ Graph }) => Graph)
);
