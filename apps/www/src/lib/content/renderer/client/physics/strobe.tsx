"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const StrobePhotoMotionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/strobe/lab"
    ).then((module) => ({ default: module.StrobePhotoMotionLab }))
  )
);
