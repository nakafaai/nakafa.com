"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const GreenhouseEffectLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/biology/climate-greenhouse"
    ).then(({ GreenhouseEffectLab }) => GreenhouseEffectLab)
  )
);

export const ClimateObservationLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/biology/climate-observation"
    ).then(({ ClimateObservationLab }) => ClimateObservationLab)
  )
);
