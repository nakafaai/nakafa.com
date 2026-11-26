"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AlveolusGasExchangeLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/alveolus/lab").then(
      (module) => ({ default: module.AlveolusGasExchangeLab })
    )
  )
);

export const ThoraxDiaphragmLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/thorax/lab").then(
      (module) => ({ default: module.ThoraxDiaphragmLab })
    )
  )
);
