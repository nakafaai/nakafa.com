"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const RelativeMovementLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/relative-movement/lab"
    ).then((module) => ({ default: module.RelativeMovementLab }))
  )
);

export const VerticalMovementLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/vertical-movement/lab"
    ).then((module) => ({ default: module.VerticalMovementLab }))
  )
);
