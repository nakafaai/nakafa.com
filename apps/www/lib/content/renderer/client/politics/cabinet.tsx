"use client";

import dynamic from "next/dynamic";

export const MerahPutihCabinetChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/merah-putih/chart"
  ).then(({ CabinetChart }) => CabinetChart)
);

export const MerahPutihCompositionChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/merah-putih/chart"
  ).then(({ CompositionChart }) => CompositionChart)
);
