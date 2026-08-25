"use client";

import dynamic from "next/dynamic";

export const Set7Question9VisitorChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-7/question-9"
  ).then(({ VisitorChart }) => VisitorChart)
);
