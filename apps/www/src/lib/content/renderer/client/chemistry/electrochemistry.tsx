"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ElectrolysisLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/electrolysis/lab"
    ).then((module) => ({ default: module.ElectrolysisLab }))
  )
);

export const ChemicalCellLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/chemistry/voltaic/lab"
    ).then((module) => ({ default: module.ChemicalCellLab }))
  )
);
