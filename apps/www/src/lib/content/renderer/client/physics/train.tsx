"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const TrainPassengerRelativeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/train/lab"
    ).then((module) => ({ default: module.TrainPassengerRelativeLab }))
  )
);
