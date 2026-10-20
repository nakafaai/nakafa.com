"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const KimPlusElectabilityChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/politics/kim-plus/chart"
    ).then((module) => ({ default: module.ElectabilityChart }))
  )
);

export const PorkBarrelElectabilityChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/politics/pork-barrel/electability"
    ).then((module) => ({ default: module.ElectabilityChart }))
  )
);
