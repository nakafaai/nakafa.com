"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const CityWalkDisplacementLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/walk/lab"
    ).then((module) => ({ default: module.CityWalkDisplacementLab }))
  )
);
