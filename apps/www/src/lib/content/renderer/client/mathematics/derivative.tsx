"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DerivativeSlopeFieldLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/slope/lab"
    ).then((module) => ({ default: module.DerivativeSlopeFieldLab }))
  )
);

export const OptimizationBox3DLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/optimize/lab"
    ).then((module) => ({ default: module.OptimizationBox3DLab }))
  )
);

export const SecantToTangentLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/secant/lab"
    ).then((module) => ({ default: module.SecantToTangentLab }))
  )
);
