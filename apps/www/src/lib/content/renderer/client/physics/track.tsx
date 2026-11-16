"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const RunningTrackDisplacementLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/track/lab"
    ).then((module) => ({ default: module.RunningTrackDisplacementLab }))
  )
);
