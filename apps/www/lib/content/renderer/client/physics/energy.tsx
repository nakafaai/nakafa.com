"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const WindEnergyConversionLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/wind-conversion/lab"
    ).then(({ WindEnergyConversionLab }) => WindEnergyConversionLab)
  )
);
