"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const KimPlusElectabilityChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/politics/kim-plus/chart"
    ).then(({ ElectabilityChart }) => ElectabilityChart)
  )
);

export const PorkBarrelElectabilityChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/politics/pork-barrel/electability"
    ).then(({ ElectabilityChart }) => ElectabilityChart)
  )
);
