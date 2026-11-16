"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const RainDriveRelativeVelocityLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/rain/lab"
    ).then((module) => ({ default: module.RainDriveRelativeVelocityLab }))
  )
);
