"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AverageVelocitySpeedLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/lab"
    ).then((module) => ({ default: module.AverageVelocitySpeedLab }))
  )
);

export const InstantaneousVelocitySpeedLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/instantaneous-velocity-speed/lab"
    ).then((module) => ({ default: module.InstantaneousVelocitySpeedLab }))
  )
);

export const VelocitySpeedLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/velocity-speed/lab"
    ).then((module) => ({ default: module.VelocitySpeedLab }))
  )
);
