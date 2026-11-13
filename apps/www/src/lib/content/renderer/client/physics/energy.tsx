"use client";

import { lazy } from "@repo/design-system/lib/lazy";
import { withHydrationBoundary } from "@/lib/content/renderer/client/boundary";

export const WindEnergyConversionLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/wind-conversion/lab"
    ).then((module) => ({ default: module.WindEnergyConversionLab }))
  )
);

export const BiogasDigesterLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/digester/lab"
    ).then((module) => ({ default: module.BiogasDigesterLab }))
  )
);

export const EnergyFlowLossLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/flow/lab"
    ).then((module) => ({ default: module.EnergyFlowLossLab }))
  )
);

export const FlashlightEfficiencyLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/flashlight/lab"
    ).then((module) => ({ default: module.FlashlightEfficiencyLab }))
  )
);

export const FuelCombustionCarbonLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/carbon/lab"
    ).then((module) => ({ default: module.FuelCombustionCarbonLab }))
  )
);

export const GeothermalLoopLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/geothermal/lab"
    ).then((module) => ({ default: module.GeothermalLoopLab }))
  )
);

export const GreenhouseLayerLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/greenhouse/lab"
    ).then((module) => ({ default: module.GreenhouseLayerLab }))
  )
);

export const GridLoadCurveLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/grid/lab"
    ).then((module) => ({ default: module.GridLoadCurveLab }))
  )
);

export const HoistWorkLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/hoist/lab"
    ).then((module) => ({ default: module.HoistWorkLab }))
  )
);

export const HydroDamLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/dam/lab"
    ).then((module) => ({ default: module.HydroDamLab }))
  )
);

export const KettleHeatingLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/kettle/lab"
    ).then((module) => ({ default: module.KettleHeatingLab }))
  )
);

export const MicrohydroLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/microhydro/lab"
    ).then((module) => ({ default: module.MicrohydroLab }))
  )
);

export const PendulumEnergyLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/pendulum/lab"
    ).then((module) => ({ default: module.PendulumEnergyLab }))
  )
);

export const SolarBatteryStorageLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/storage/lab"
    ).then((module) => ({ default: module.SolarBatteryStorageLab }))
  )
);

export const SolarPanelAngleLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/sun/lab"
    ).then((module) => ({ default: module.SolarPanelAngleLab }))
  )
);

export const SolarPanelHeatLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/panel/lab"
    ).then((module) => ({ default: module.SolarPanelHeatLab }))
  )
);

export const SolarRoofPaybackLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/payback/lab"
    ).then((module) => ({ default: module.SolarRoofPaybackLab }))
  )
);

export const SteamPlantCycleLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/steam/lab"
    ).then((module) => ({ default: module.SteamPlantCycleLab }))
  )
);

export const WaveBuoyPowerLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/wave/lab"
    ).then((module) => ({ default: module.WaveBuoyPowerLab }))
  )
);

export const WeightLampEnergyLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/lamp/lab"
    ).then((module) => ({ default: module.WeightLampEnergyLab }))
  )
);

export const WindRotorLab = withHydrationBoundary(
  lazy(() =>
    import(
      "@repo/design-system/components/contents/physics/renewable-energy/wind/lab"
    ).then((module) => ({ default: module.WindRotorLab }))
  )
);
