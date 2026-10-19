"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NonUniformLinearMotionGraphCard = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/chart-card"
    ).then(
      ({ NonUniformLinearMotionGraphCard }) => NonUniformLinearMotionGraphCard
    )
  )
);

export const NonUniformLinearMotionLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/lab"
    ).then(({ NonUniformLinearMotionLab }) => NonUniformLinearMotionLab)
  )
);

export const UniformLinearMotionLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/uniform-linear-motion/lab"
    ).then(({ UniformLinearMotionLab }) => UniformLinearMotionLab)
  )
);
