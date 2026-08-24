"use client";

import dynamic from "next/dynamic";

export const Set5Question12Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-5/question-12"
  ).then(({ QuestionGraph }) => QuestionGraph)
);

export const Set5Question9Graph = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/quantitative/set-5/question-9"
  ).then(({ QuestionGraph }) => QuestionGraph)
);
