"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const Set8Question17ProfitChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-8/question-17"
    ).then((module) => ({ default: module.ProfitChart }))
  )
);

export const Set8Question1SalesChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/snbt/general/set-8/question-1"
    ).then((module) => ({ default: module.SalesChart }))
  )
);
