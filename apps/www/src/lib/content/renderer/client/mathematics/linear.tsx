"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const EigenTransform3DLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/mathematics/eigen/lab"
    ).then((module) => ({ default: module.EigenTransform3DLab }))
  )
);

export const PcaProjection3DLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/mathematics/pca/lab").then(
      (module) => ({ default: module.PcaProjection3DLab })
    )
  )
);

export const QrGramSchmidt3DLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/mathematics/qr/lab").then(
      (module) => ({ default: module.QrGramSchmidt3DLab })
    )
  )
);
