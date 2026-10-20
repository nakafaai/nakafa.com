"use client";

import { lazy } from "react";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MerahPutihCabinetChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/politics/merah-putih/chart"
    ).then((module) => ({ default: module.CabinetChart }))
  )
);

export const MerahPutihCompositionChart = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/politics/merah-putih/chart"
    ).then((module) => ({ default: module.CompositionChart }))
  )
);
