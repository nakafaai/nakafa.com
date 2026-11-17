"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BulletBlockLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/mechanics/bullet/lab"
    ).then((module) => ({ default: module.BulletBlockLab }))
  )
);

export const CliffThrowLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/mechanics/cliff/lab"
    ).then((module) => ({ default: module.CliffThrowLab }))
  )
);

export const ConnectedBlocksLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/mechanics/blocks/lab"
    ).then((module) => ({ default: module.ConnectedBlocksLab }))
  )
);

export const InclineSlideLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/mechanics/incline/lab"
    ).then((module) => ({ default: module.InclineSlideLab }))
  )
);

export const LiftScaleLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/mechanics/lift/lab"
    ).then((module) => ({ default: module.LiftScaleLab }))
  )
);

export const RecoilLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/mechanics/recoil/lab"
    ).then((module) => ({ default: module.RecoilLab }))
  )
);

export const SpringChainLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/mechanics/springs/lab"
    ).then((module) => ({ default: module.SpringChainLab }))
  )
);
