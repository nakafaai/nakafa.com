"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const PorkBarrelBudgetChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/politics/pork-barrel/budget"
    ).then((module) => ({ default: module.BudgetChart }))
  )
);

export const PorkBarrelFundChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/politics/pork-barrel/fund"
    ).then((module) => ({ default: module.FundChart }))
  )
);
