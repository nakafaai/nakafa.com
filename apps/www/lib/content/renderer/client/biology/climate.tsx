"use client";

import dynamic from "next/dynamic";

export const GreenhouseEffectLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/climate-greenhouse"
  ).then(({ GreenhouseEffectLab }) => GreenhouseEffectLab)
);

export const ClimateObservationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/biology/climate-observation"
  ).then(({ ClimateObservationLab }) => ClimateObservationLab)
);
