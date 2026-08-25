"use client";

import dynamic from "next/dynamic";

export const PorkBarrelBudgetChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/pork-barrel/budget"
  ).then(({ BudgetChart }) => BudgetChart)
);

export const PorkBarrelFundChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/pork-barrel/fund"
  ).then(({ FundChart }) => FundChart)
);
