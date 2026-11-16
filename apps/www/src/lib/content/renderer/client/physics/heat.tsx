"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const GasPistonLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/physics/heat/gas/lab").then(
      (module) => ({ default: module.GasPistonLab })
    )
  )
);

export const HeatingCurveLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/heat/curve/lab"
    ).then((module) => ({ default: module.HeatingCurveLab }))
  )
);

export const IceMeltingLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/physics/heat/ice/lab").then(
      (module) => ({ default: module.IceMeltingLab })
    )
  )
);
