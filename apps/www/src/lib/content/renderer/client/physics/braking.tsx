"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BrakeHeatLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/stopping-distance/disc"
    ).then((module) => ({ default: module.BrakeHeatLab }))
  )
);

export const BrakingSurfaceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/stopping-distance/surface"
    ).then((module) => ({ default: module.BrakingSurfaceLab }))
  )
);

export const FollowingDistanceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/stopping-distance/following"
    ).then((module) => ({ default: module.FollowingDistanceLab }))
  )
);

export const ReactionTimeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/stopping-distance/reaction"
    ).then((module) => ({ default: module.ReactionTimeLab }))
  )
);
