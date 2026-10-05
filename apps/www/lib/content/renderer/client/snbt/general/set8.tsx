"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set8Question17ProfitChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-8/question-17"
    ).then(({ ProfitChart }) => ProfitChart)
  )
);

export const Set8Question1SalesChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-8/question-1"
    ).then(({ SalesChart }) => SalesChart)
  )
);
