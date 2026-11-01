"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const GreenhouseEffectLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/climate-greenhouse"
    ).then((module) => ({ default: module.GreenhouseEffectLab }))
  )
);

export const ClimateObservationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/climate-observation"
    ).then((module) => ({ default: module.ClimateObservationLab }))
  )
);
