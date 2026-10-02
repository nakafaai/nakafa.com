"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set2Question15SalesChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-2/question-15"
    ).then(({ SalesChart }) => SalesChart)
  )
);

export const Set2Question5SalesChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-2/question-5"
    ).then(({ SalesChart }) => SalesChart)
  )
);
