"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DisplacementDistanceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/displacement-distance/lab"
    ).then((module) => ({ default: module.DisplacementDistanceLab }))
  )
);

export const StoppingDistanceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/stopping-distance/lab"
    ).then((module) => ({ default: module.StoppingDistanceLab }))
  )
);
