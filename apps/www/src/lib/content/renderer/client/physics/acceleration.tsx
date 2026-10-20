"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AccelerationGraphCard = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/acceleration/chart-card"
    ).then(({ AccelerationGraphCard }) => AccelerationGraphCard)
  )
);

export const AccelerationLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/acceleration/lab"
    ).then(({ AccelerationLab }) => AccelerationLab)
  )
);
