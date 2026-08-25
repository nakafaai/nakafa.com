"use client";

import dynamic from "next/dynamic";

export const WindEnergyConversionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/renewable-energy/wind-conversion/lab"
  ).then(({ WindEnergyConversionLab }) => WindEnergyConversionLab)
);
