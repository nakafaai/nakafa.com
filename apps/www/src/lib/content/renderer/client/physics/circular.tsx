"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const UniformCircularMotionLab = withHydrationBoundary(
  lazy(async () => ({
    default: await (() =>
      import(
        "@repo/design-system/components/contents/physics/kinematics/uniform-circular-motion/lab"
      ).then(({ UniformCircularMotionLab }) => UniformCircularMotionLab))(),
  }))
);
