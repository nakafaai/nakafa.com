"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ChloroplastStageLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/chloroplast/lab"
    ).then((module) => ({ default: module.ChloroplastStageLab }))
  )
);

export const LeafLaminaCrossSectionLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/lamina/lab").then(
      (module) => ({ default: module.LeafLaminaCrossSectionLab })
    )
  )
);

export const StomatalGuardCellLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/stomata/lab").then(
      (module) => ({ default: module.StomatalGuardCellLab })
    )
  )
);
