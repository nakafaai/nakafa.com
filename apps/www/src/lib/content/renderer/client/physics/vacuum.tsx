"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const FeatherCoinVacuumLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/kinematics/vacuum/lab"
    ).then((module) => ({ default: module.FeatherCoinVacuumLab }))
  )
);
