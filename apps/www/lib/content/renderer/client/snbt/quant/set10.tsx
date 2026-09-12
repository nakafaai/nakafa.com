"use client";

import dynamic from "next/dynamic";

export const Set10Question8Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-10/question-8"
  ).then(({ Graph }) => Graph)
);
