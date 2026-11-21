"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const MitochondrionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/mitochondrion/lab"
    ).then((module) => ({ default: module.MitochondrionLab }))
  )
);

export const OxygenDebtLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/muscle/lab").then(
      (module) => ({ default: module.OxygenDebtLab })
    )
  )
);

export const PaddyRootLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/paddy/lab").then(
      (module) => ({ default: module.PaddyRootLab })
    )
  )
);

export const YeastFermentationLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/yeast/lab").then(
      (module) => ({ default: module.YeastFermentationLab })
    )
  )
);
