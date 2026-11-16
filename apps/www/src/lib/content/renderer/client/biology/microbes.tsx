"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BinaryFissionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/bacteria/fission"
    ).then((module) => ({ default: module.BinaryFissionLab }))
  )
);

export const ChemotaxisLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/bacteria/swim"
    ).then((module) => ({ default: module.ChemotaxisLab }))
  )
);

export const GramStainLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/bacteria/gram"
    ).then((module) => ({ default: module.GramStainLab }))
  )
);

export const YogurtLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/bacteria/yogurt"
    ).then((module) => ({ default: module.YogurtLab }))
  )
);
