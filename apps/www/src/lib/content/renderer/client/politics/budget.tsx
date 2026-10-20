"use client";

import { lazy } from "react";
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
