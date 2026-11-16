"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const FloatingBlockLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/fluid/float/lab"
    ).then((module) => ({ default: module.FloatingBlockLab }))
  )
);

export const HydraulicJackLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/fluid/jack/lab"
    ).then((module) => ({ default: module.HydraulicJackLab }))
  )
);

export const ManometerLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/fluid/manometer/lab"
    ).then((module) => ({ default: module.ManometerLab }))
  )
);

export const VenturiTubeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/fluid/venturi/lab"
    ).then((module) => ({ default: module.VenturiTubeLab }))
  )
);
