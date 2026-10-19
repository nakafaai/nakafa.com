"use client";

import { lazyComponent } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MerahPutihCabinetChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/politics/merah-putih/chart"
    ).then(({ CabinetChart }) => CabinetChart)
  )
);

export const MerahPutihCompositionChart = withHydrationBoundary(
  lazyComponent(() =>
    import(
      "@repo/design-system/components/contents/politics/merah-putih/chart"
    ).then(({ CompositionChart }) => CompositionChart)
  )
);
