"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const RiverBoatCrossingLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/river/lab"
    ).then((module) => ({ default: module.RiverBoatCrossingLab }))
  )
);
