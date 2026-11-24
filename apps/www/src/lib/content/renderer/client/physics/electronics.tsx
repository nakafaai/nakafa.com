"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const LogicGateLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/electronics/gates/lab"
    ).then((module) => ({ default: module.LogicGateLab }))
  )
);

export const RectifierDiodeLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/rectifier/lab"
    ).then((module) => ({ default: module.RectifierDiodeLab }))
  )
);

export const TransistorBiasLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/electronics/bias/lab"
    ).then((module) => ({ default: module.TransistorBiasLab }))
  )
);

export const TransistorSwitchLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/electronics/switch/lab"
    ).then((module) => ({ default: module.TransistorSwitchLab }))
  )
);
