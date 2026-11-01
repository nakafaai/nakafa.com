"use client";

import { lazy } from "@repo/design-system/lib/lazy";
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
