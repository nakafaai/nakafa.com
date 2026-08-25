"use client";

import dynamic from "next/dynamic";

export const Set9Question9GraduationChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/snbt/general/set-9/question-9"
  ).then(({ GraduationChart }) => GraduationChart)
);
