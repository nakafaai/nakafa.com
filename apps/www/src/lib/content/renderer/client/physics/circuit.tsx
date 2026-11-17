"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const BulbNetworkLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/circuit/bulbs/lab"
    ).then((module) => ({ default: module.BulbNetworkLab }))
  )
);

export const HeaterSupplyLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/circuit/heater/lab"
    ).then((module) => ({ default: module.HeaterSupplyLab }))
  )
);

export const InternalResistanceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/circuit/cell/lab"
    ).then((module) => ({ default: module.InternalResistanceLab }))
  )
);

export const WireResistanceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/circuit/wire/lab"
    ).then((module) => ({ default: module.WireResistanceLab }))
  )
);
