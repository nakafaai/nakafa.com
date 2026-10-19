"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const GreenhouseEffectLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/biology/climate-greenhouse"
    ).then(({ GreenhouseEffectLab }) => GreenhouseEffectLab)
  )
);

export const ClimateObservationLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/biology/climate-observation"
    ).then(({ ClimateObservationLab }) => ClimateObservationLab)
  )
);
