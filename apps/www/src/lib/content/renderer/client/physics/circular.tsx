"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const UniformCircularMotionLab = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/uniform-circular-motion/lab"
    ).then(({ UniformCircularMotionLab }) => UniformCircularMotionLab)
  )
);
