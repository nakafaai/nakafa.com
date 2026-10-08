"use client";

import dynamic from "next/dynamic";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MerahPutihCabinetChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/politics/merah-putih/chart"
    ).then(({ CabinetChart }) => CabinetChart)
  )
);

export const MerahPutihCompositionChart = withHydrationBoundary(
  dynamic(() =>
    import(
      "@repo/design-system/components/contents/politics/merah-putih/chart"
    ).then(({ CompositionChart }) => CompositionChart)
  )
);
