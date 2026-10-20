"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AccelerationGraphCard = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/acceleration/chart-card"
    ).then((module) => ({ default: module.AccelerationGraphCard }))
  )
);

export const AccelerationLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/acceleration/lab"
    ).then((module) => ({ default: module.AccelerationLab }))
  )
);
