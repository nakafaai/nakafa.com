"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const UniformCircularMotionLab = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/uniform-circular-motion/lab"
    ).then(({ UniformCircularMotionLab }) => UniformCircularMotionLab)
  )
);
