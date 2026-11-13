"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const GreenhouseEffectLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/climate/greenhouse"
    ).then((module) => ({ default: module.GreenhouseEffectLab }))
  )
);

export const ClimateObservationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/climate/observation"
    ).then((module) => ({ default: module.ClimateObservationLab }))
  )
);

export const CarbonBudgetLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/climate/carbon"
    ).then((module) => ({ default: module.CarbonBudgetLab }))
  )
);

export const CoralBleachLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/climate/reef").then(
      (module) => ({ default: module.CoralBleachLab })
    )
  )
);

export const SeaLevelRiseLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/climate/coast"
    ).then((module) => ({ default: module.SeaLevelRiseLab }))
  )
);
