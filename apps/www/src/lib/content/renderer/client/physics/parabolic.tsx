"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ParabolicMovementLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/lab"
    ).then((module) => ({ default: module.ParabolicMovementLab }))
  )
);

export const ParabolicMovementAnalysisLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/lab"
    ).then((module) => ({ default: module.ParabolicMovementAnalysisLab }))
  )
);
