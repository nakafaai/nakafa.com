"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const PorkBarrelBudgetChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/politics/pork-barrel/budget"
    ).then(({ BudgetChart }) => BudgetChart)
  )
);

export const PorkBarrelFundChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/politics/pork-barrel/fund"
    ).then(({ FundChart }) => FundChart)
  )
);
