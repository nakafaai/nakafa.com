"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DimensionLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/dimension/lab"
    ).then(({ DimensionLab }) => DimensionLab)
  )
);

export const MeasurementToolsLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/tools/lab"
    ).then(({ MeasurementToolsLab }) => MeasurementToolsLab)
  )
);
