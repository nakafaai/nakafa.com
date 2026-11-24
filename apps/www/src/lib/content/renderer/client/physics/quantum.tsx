"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DeBroglieMatterWaveLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/debroglie/lab"
    ).then((module) => ({ default: module.DeBroglieMatterWaveLab }))
  )
);

export const PlanckBlackbodyLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/physics/planck/lab").then(
      (module) => ({ default: module.PlanckBlackbodyLab })
    )
  )
);
