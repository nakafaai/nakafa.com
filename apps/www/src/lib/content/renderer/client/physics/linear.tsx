"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NonUniformLinearMotionGraphCard = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/chart-card"
    ).then((module) => ({ default: module.NonUniformLinearMotionGraphCard }))
  )
);

export const NonUniformLinearMotionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/lab"
    ).then((module) => ({ default: module.NonUniformLinearMotionLab }))
  )
);

export const UniformLinearMotionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/uniform-linear-motion/lab"
    ).then((module) => ({ default: module.UniformLinearMotionLab }))
  )
);
