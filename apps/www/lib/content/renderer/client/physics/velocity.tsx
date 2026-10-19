"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AverageVelocitySpeedLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/lab"
    ).then(({ AverageVelocitySpeedLab }) => AverageVelocitySpeedLab)
  )
);

export const InstantaneousVelocitySpeedLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/instantaneous-velocity-speed/lab"
    ).then(({ InstantaneousVelocitySpeedLab }) => InstantaneousVelocitySpeedLab)
  )
);

export const VelocitySpeedLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/velocity-speed/lab"
    ).then(({ VelocitySpeedLab }) => VelocitySpeedLab)
  )
);
