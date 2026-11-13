"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const SatelliteOrbitCircularLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/orbit/lab"
    ).then((module) => ({ default: module.SatelliteOrbitCircularLab }))
  )
);
