"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const PorkBarrelBudgetChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/politics/pork-barrel/budget"
    ).then(({ BudgetChart }) => BudgetChart)
  )
);

export const PorkBarrelFundChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/politics/pork-barrel/fund"
    ).then(({ FundChart }) => FundChart)
  )
);
