"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const AbacusBaseLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/abacus/lab"
    ).then((module) => ({ default: module.AbacusBaseLab }))
  )
);

export const BinaryLampLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/binary/lab"
    ).then((module) => ({ default: module.BinaryLampLab }))
  )
);
