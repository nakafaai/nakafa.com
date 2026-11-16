"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const CurrentBalanceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/field/balance/lab"
    ).then((module) => ({ default: module.CurrentBalanceLab }))
  )
);

export const MagnetPipeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/field/pipe/lab"
    ).then((module) => ({ default: module.MagnetPipeLab }))
  )
);

export const TransformerLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/field/transformer/lab"
    ).then((module) => ({ default: module.TransformerLab }))
  )
);
