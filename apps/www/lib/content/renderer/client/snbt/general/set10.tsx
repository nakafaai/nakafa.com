"use client";

import dynamic from "next/dynamic";

export const Set10Question2RecruitmentChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-10/question-2"
  ).then(({ RecruitmentChart }) => RecruitmentChart)
);
