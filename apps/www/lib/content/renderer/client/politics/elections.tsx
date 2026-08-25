"use client";

import dynamic from "next/dynamic";

export const KimPlusElectabilityChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/kim-plus/chart"
  ).then(({ ElectabilityChart }) => ElectabilityChart)
);

export const PorkBarrelElectabilityChart = dynamic(() =>
  import(
    "@repo/design-system/components/contents/politics/pork-barrel/electability"
  ).then(({ ElectabilityChart }) => ElectabilityChart)
);
