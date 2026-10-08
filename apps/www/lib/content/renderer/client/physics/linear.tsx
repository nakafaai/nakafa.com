"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const NonUniformLinearMotionGraphCard = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/chart-card"
    ).then(
      ({ NonUniformLinearMotionGraphCard }) => NonUniformLinearMotionGraphCard
    )
  )
);

export const NonUniformLinearMotionLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/lab"
    ).then(({ NonUniformLinearMotionLab }) => NonUniformLinearMotionLab)
  )
);

export const UniformLinearMotionLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/uniform-linear-motion/lab"
    ).then(({ UniformLinearMotionLab }) => UniformLinearMotionLab)
  )
);
