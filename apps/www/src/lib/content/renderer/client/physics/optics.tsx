"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const ApparentDepthLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/optics/depth/lab"
    ).then((module) => ({ default: module.ApparentDepthLab }))
  )
);

export const ConvexLensLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/optics/lens/lab"
    ).then((module) => ({ default: module.ConvexLensLab }))
  )
);

export const GlassBlockLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/optics/block/lab"
    ).then((module) => ({ default: module.GlassBlockLab }))
  )
);

export const TelescopeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/optics/telescope/lab"
    ).then((module) => ({ default: module.TelescopeLab }))
  )
);
