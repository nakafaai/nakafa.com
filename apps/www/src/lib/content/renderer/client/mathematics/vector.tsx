"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DotProductProjection3DLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/projection/lab"
    ).then((module) => ({ default: module.DotProductProjection3DLab }))
  )
);

export const Vector3DCrossProductLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/cross/lab"
    ).then((module) => ({ default: module.Vector3DCrossProductLab }))
  )
);

export const VectorParallelepipedLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/parallelepiped/lab"
    ).then((module) => ({ default: module.VectorParallelepipedLab }))
  )
);
