"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const DimensionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/dimension/lab"
    ).then((module) => ({ default: module.DimensionLab }))
  )
);

export const MeasurementToolsLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/tools/lab"
    ).then((module) => ({ default: module.MeasurementToolsLab }))
  )
);

export const BoltDimensionsLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/bolt/lab"
    ).then((module) => ({ default: module.BoltDimensionsLab }))
  )
);

export const CommonReferenceLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/reference/lab"
    ).then((module) => ({ default: module.CommonReferenceLab }))
  )
);

export const DecimalSumLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/sum/lab"
    ).then((module) => ({ default: module.DecimalSumLab }))
  )
);

export const DensityMeasurementLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/density/lab"
    ).then((module) => ({ default: module.DensityMeasurementLab }))
  )
);

export const LightGateSpeedLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/gate/lab"
    ).then((module) => ({ default: module.LightGateSpeedLab }))
  )
);

export const MicrometerScrewLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/micrometer/lab"
    ).then((module) => ({ default: module.MicrometerScrewLab }))
  )
);

export const MicroscopeScaleLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/microscope/lab"
    ).then((module) => ({ default: module.MicroscopeScaleLab }))
  )
);

export const PaperStackLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/paper/lab"
    ).then((module) => ({ default: module.PaperStackLab }))
  )
);

export const ParallaxReadingLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/parallax/lab"
    ).then((module) => ({ default: module.ParallaxReadingLab }))
  )
);

export const PendulumPeriodLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/pendulum/lab"
    ).then((module) => ({ default: module.PendulumPeriodLab }))
  )
);

export const SignificantZerosLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/zeros/lab"
    ).then((module) => ({ default: module.SignificantZerosLab }))
  )
);

export const StopwatchSpreadLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/stopwatch/lab"
    ).then((module) => ({ default: module.StopwatchSpreadLab }))
  )
);

export const UnitSystemsLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/systems/lab"
    ).then((module) => ({ default: module.UnitSystemsLab }))
  )
);

export const VernierCaliperLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/measurement/vernier/lab"
    ).then((module) => ({ default: module.VernierCaliperLab }))
  )
);
