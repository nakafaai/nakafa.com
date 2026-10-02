"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set7Question9VisitorChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-7/question-9"
    ).then(({ VisitorChart }) => VisitorChart)
  )
);
