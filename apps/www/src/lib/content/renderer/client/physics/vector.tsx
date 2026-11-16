"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const VectorConceptLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/concept/lab"
    ).then((module) => ({ default: module.VectorConceptLab }))
  )
);

export const AircraftCrosswindLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/aircraft/lab"
    ).then((module) => ({ default: module.AircraftCrosswindLab }))
  )
);

export const DoorHingeTorqueLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/door/lab"
    ).then((module) => ({ default: module.DoorHingeTorqueLab }))
  )
);

export const DroneDisplacementLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/drone/lab"
    ).then((module) => ({ default: module.DroneDisplacementLab }))
  )
);

export const ForceTableResultantLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/table/lab"
    ).then((module) => ({ default: module.ForceTableResultantLab }))
  )
);

export const KiteStringTensionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/kite/lab"
    ).then((module) => ({ default: module.KiteStringTensionLab }))
  )
);

export const OrienteeringMapVectorLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/orienteering/lab"
    ).then((module) => ({ default: module.OrienteeringMapVectorLab }))
  )
);

export const RampBlockComponentLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/ramp/lab"
    ).then((module) => ({ default: module.RampBlockComponentLab }))
  )
);

export const ShipBearingComponentLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/bearing/lab"
    ).then((module) => ({ default: module.ShipBearingComponentLab }))
  )
);

export const SledPullWorkLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/sled/lab"
    ).then((module) => ({ default: module.SledPullWorkLab }))
  )
);

export const SolarPanelFluxLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/solar/lab"
    ).then((module) => ({ default: module.SolarPanelFluxLab }))
  )
);

export const TugboatResultantLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/tugboat/lab"
    ).then((module) => ({ default: module.TugboatResultantLab }))
  )
);

export const TugOfWarForceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/tug/lab"
    ).then((module) => ({ default: module.TugOfWarForceLab }))
  )
);

export const WindMapVectorLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/wind/lab"
    ).then((module) => ({ default: module.WindMapVectorLab }))
  )
);

export const WrenchTorqueLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/vector/wrench/lab"
    ).then((module) => ({ default: module.WrenchTorqueLab }))
  )
);
