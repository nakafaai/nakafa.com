"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set10Question2RecruitmentChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-10/question-2"
    ).then(({ RecruitmentChart }) => RecruitmentChart)
  )
);
