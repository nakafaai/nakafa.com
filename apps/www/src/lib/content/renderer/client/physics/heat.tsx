"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const GasLawThermalLab = withHydrationBoundary(
  lazy(() =>
    import("@repo/design-system/components/contents/physics/gaslaw/lab").then(
      (module) => ({ default: module.GasLawThermalLab })
    )
  )
);

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

export const GasProcessLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/thermodynamics/gas-process/lab"
    ).then((module) => ({ default: module.GasProcessLab }))
  )
);

export const SpecificHeatCalorimeterLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/calorimeter/lab"
    ).then((module) => ({ default: module.SpecificHeatCalorimeterLab }))
  )
);
