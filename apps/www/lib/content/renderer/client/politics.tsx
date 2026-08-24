"use client";

import dynamic from "next/dynamic";

export const LazyKimPlusElectabilityChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/kim-plus/chart"
  ).then(({ ElectabilityChart }) => ElectabilityChart)
);
export const LazyMerahPutihCabinetChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/merah-putih/chart"
  ).then(({ CabinetChart }) => CabinetChart)
);
export const LazyMerahPutihCompositionChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/merah-putih/chart"
  ).then(({ CompositionChart }) => CompositionChart)
);
export const LazyPorkBarrelBudgetChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/pork-barrel/budget"
  ).then(({ BudgetChart }) => BudgetChart)
);
export const LazyPorkBarrelElectabilityChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/pork-barrel/electability"
  ).then(({ ElectabilityChart }) => ElectabilityChart)
);
export const LazyPorkBarrelFundChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/pork-barrel/fund"
  ).then(({ FundChart }) => FundChart)
);
