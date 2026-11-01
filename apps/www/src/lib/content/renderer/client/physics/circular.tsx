"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const UniformCircularMotionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/uniform-circular-motion/lab"
    ).then((module) => ({ default: module.UniformCircularMotionLab }))
  )
);
