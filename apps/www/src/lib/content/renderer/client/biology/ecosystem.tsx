"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const EcologicalSuccessionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/biology/succession/lab"
    ).then((module) => ({ default: module.EcologicalSuccessionLab }))
  )
);

export const FoodWebTrophicLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/trophic/lab").then(
      (module) => ({ default: module.FoodWebTrophicLab })
    )
  )
);

export const QuadratSamplingLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/biology/quadrat/lab").then(
      (module) => ({ default: module.QuadratSamplingLab })
    )
  )
);
