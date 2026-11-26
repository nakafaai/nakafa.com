"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const HalogenDisplacementLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/halogen/lab"
    ).then((module) => ({ default: module.HalogenDisplacementLab }))
  )
);

export const PeriodThreeOxideLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/chemistry/oxide/lab").then(
      (module) => ({ default: module.PeriodThreeOxideLab })
    )
  )
);
