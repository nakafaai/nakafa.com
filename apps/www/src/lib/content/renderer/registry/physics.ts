import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  AccelerationGraphCard,
  AccelerationLab,
} from "@/lib/content/renderer/client/physics/acceleration";
import {
  BrakeHeatLab,
  BrakingSurfaceLab,
  FollowingDistanceLab,
  ReactionTimeLab,
} from "@/lib/content/renderer/client/physics/braking";
import { UniformCircularMotionLab } from "@/lib/content/renderer/client/physics/circular";
import {
  DisplacementDistanceLab,
  StoppingDistanceLab,
} from "@/lib/content/renderer/client/physics/distance";
import {
  BiogasDigesterLab,
  EnergyFlowLossLab,
  FlashlightEfficiencyLab,
  FuelCombustionCarbonLab,
  GeothermalLoopLab,
  GreenhouseLayerLab,
  GridLoadCurveLab,
  HoistWorkLab,
  HydroDamLab,
  KettleHeatingLab,
  MicrohydroLab,
  PendulumEnergyLab,
  SolarBatteryStorageLab,
  SolarPanelAngleLab,
  SolarPanelHeatLab,
  SolarRoofPaybackLab,
  SteamPlantCycleLab,
  WaveBuoyPowerLab,
  WeightLampEnergyLab,
  WindEnergyConversionLab,
  WindRotorLab,
} from "@/lib/content/renderer/client/physics/energy";
import { HoseJetProjectileLab } from "@/lib/content/renderer/client/physics/fountain";
import { GalileoInclineBellsLab } from "@/lib/content/renderer/client/physics/galileo";
import { FallingTargetAimLab } from "@/lib/content/renderer/client/physics/hunter";
import {
  NonUniformLinearMotionGraphCard,
  NonUniformLinearMotionLab,
  UniformLinearMotionLab,
} from "@/lib/content/renderer/client/physics/linear";
import {
  DimensionLab,
  MeasurementToolsLab,
} from "@/lib/content/renderer/client/physics/measurement";
import {
  RelativeMovementLab,
  VerticalMovementLab,
} from "@/lib/content/renderer/client/physics/movement";
import { SatelliteOrbitCircularLab } from "@/lib/content/renderer/client/physics/orbit";
import {
  ParabolicMovementAnalysisLab,
  ParabolicMovementLab,
} from "@/lib/content/renderer/client/physics/parabolic";
import { RainDriveRelativeVelocityLab } from "@/lib/content/renderer/client/physics/rain";
import { RiverBoatCrossingLab } from "@/lib/content/renderer/client/physics/river";
import { StringWhirlReleaseLab } from "@/lib/content/renderer/client/physics/sling";
import { StreetOriginPositionLab } from "@/lib/content/renderer/client/physics/street";
import { StrobePhotoMotionLab } from "@/lib/content/renderer/client/physics/strobe";
import { TickerTapeMotionLab } from "@/lib/content/renderer/client/physics/ticker";
import { RunningTrackDisplacementLab } from "@/lib/content/renderer/client/physics/track";
import { TrainPassengerRelativeLab } from "@/lib/content/renderer/client/physics/train";
import { SpeedTrapInstantSpeedLab } from "@/lib/content/renderer/client/physics/trap";
import { CarTripSecantSlopeLab } from "@/lib/content/renderer/client/physics/trip";
import { FeatherCoinVacuumLab } from "@/lib/content/renderer/client/physics/vacuum";
import { VectorConceptLab } from "@/lib/content/renderer/client/physics/vector";
import {
  AverageVelocitySpeedLab,
  InstantaneousVelocitySpeedLab,
  VelocitySpeedLab,
} from "@/lib/content/renderer/client/physics/velocity";
import { CityWalkDisplacementLab } from "@/lib/content/renderer/client/physics/walk";
import { BicycleWheelSpeedLab } from "@/lib/content/renderer/client/physics/wheel";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every physics visual, which any lesson in any domain may use. */
export const physicsRenderers = [
  {
    name: physicsComponentNames.accelerationGraphCard,
    component: AccelerationGraphCard,
  },
  {
    name: physicsComponentNames.accelerationLab,
    component: AccelerationLab,
  },
  {
    name: physicsComponentNames.averageVelocitySpeedLab,
    component: AverageVelocitySpeedLab,
  },
  {
    name: physicsComponentNames.bicycleWheelSpeedLab,
    component: BicycleWheelSpeedLab,
  },
  {
    name: physicsComponentNames.biogasDigesterLab,
    component: BiogasDigesterLab,
  },
  {
    name: physicsComponentNames.brakeHeatLab,
    component: BrakeHeatLab,
  },
  {
    name: physicsComponentNames.brakingSurfaceLab,
    component: BrakingSurfaceLab,
  },
  {
    name: physicsComponentNames.carTripSecantSlopeLab,
    component: CarTripSecantSlopeLab,
  },
  {
    name: physicsComponentNames.cityWalkDisplacementLab,
    component: CityWalkDisplacementLab,
  },
  {
    name: physicsComponentNames.dimensionLab,
    component: DimensionLab,
  },
  {
    name: physicsComponentNames.displacementDistanceLab,
    component: DisplacementDistanceLab,
  },
  {
    name: physicsComponentNames.energyFlowLossLab,
    component: EnergyFlowLossLab,
  },
  {
    name: physicsComponentNames.fallingTargetAimLab,
    component: FallingTargetAimLab,
  },
  {
    name: physicsComponentNames.featherCoinVacuumLab,
    component: FeatherCoinVacuumLab,
  },
  {
    name: physicsComponentNames.flashlightEfficiencyLab,
    component: FlashlightEfficiencyLab,
  },
  {
    name: physicsComponentNames.followingDistanceLab,
    component: FollowingDistanceLab,
  },
  {
    name: physicsComponentNames.fuelCombustionCarbonLab,
    component: FuelCombustionCarbonLab,
  },
  {
    name: physicsComponentNames.galileoInclineBellsLab,
    component: GalileoInclineBellsLab,
  },
  {
    name: physicsComponentNames.geothermalLoopLab,
    component: GeothermalLoopLab,
  },
  {
    name: physicsComponentNames.greenhouseLayerLab,
    component: GreenhouseLayerLab,
  },
  {
    name: physicsComponentNames.gridLoadCurveLab,
    component: GridLoadCurveLab,
  },
  {
    name: physicsComponentNames.hoistWorkLab,
    component: HoistWorkLab,
  },
  {
    name: physicsComponentNames.hoseJetProjectileLab,
    component: HoseJetProjectileLab,
  },
  {
    name: physicsComponentNames.hydroDamLab,
    component: HydroDamLab,
  },
  {
    name: physicsComponentNames.instantaneousVelocitySpeedLab,
    component: InstantaneousVelocitySpeedLab,
  },
  {
    name: physicsComponentNames.kettleHeatingLab,
    component: KettleHeatingLab,
  },
  {
    name: physicsComponentNames.measurementToolsLab,
    component: MeasurementToolsLab,
  },
  {
    name: physicsComponentNames.microhydroLab,
    component: MicrohydroLab,
  },
  {
    name: physicsComponentNames.nonUniformLinearMotionGraphCard,
    component: NonUniformLinearMotionGraphCard,
  },
  {
    name: physicsComponentNames.nonUniformLinearMotionLab,
    component: NonUniformLinearMotionLab,
  },
  {
    name: physicsComponentNames.parabolicMovementAnalysisLab,
    component: ParabolicMovementAnalysisLab,
  },
  {
    name: physicsComponentNames.parabolicMovementLab,
    component: ParabolicMovementLab,
  },
  {
    name: physicsComponentNames.pendulumEnergyLab,
    component: PendulumEnergyLab,
  },
  {
    name: physicsComponentNames.rainDriveRelativeVelocityLab,
    component: RainDriveRelativeVelocityLab,
  },
  {
    name: physicsComponentNames.reactionTimeLab,
    component: ReactionTimeLab,
  },
  {
    name: physicsComponentNames.relativeMovementLab,
    component: RelativeMovementLab,
  },
  {
    name: physicsComponentNames.riverBoatCrossingLab,
    component: RiverBoatCrossingLab,
  },
  {
    name: physicsComponentNames.runningTrackDisplacementLab,
    component: RunningTrackDisplacementLab,
  },
  {
    name: physicsComponentNames.satelliteOrbitCircularLab,
    component: SatelliteOrbitCircularLab,
  },
  {
    name: physicsComponentNames.solarBatteryStorageLab,
    component: SolarBatteryStorageLab,
  },
  {
    name: physicsComponentNames.solarPanelAngleLab,
    component: SolarPanelAngleLab,
  },
  {
    name: physicsComponentNames.solarPanelHeatLab,
    component: SolarPanelHeatLab,
  },
  {
    name: physicsComponentNames.solarRoofPaybackLab,
    component: SolarRoofPaybackLab,
  },
  {
    name: physicsComponentNames.speedTrapInstantSpeedLab,
    component: SpeedTrapInstantSpeedLab,
  },
  {
    name: physicsComponentNames.steamPlantCycleLab,
    component: SteamPlantCycleLab,
  },
  {
    name: physicsComponentNames.stoppingDistanceLab,
    component: StoppingDistanceLab,
  },
  {
    name: physicsComponentNames.streetOriginPositionLab,
    component: StreetOriginPositionLab,
  },
  {
    name: physicsComponentNames.stringWhirlReleaseLab,
    component: StringWhirlReleaseLab,
  },
  {
    name: physicsComponentNames.strobePhotoMotionLab,
    component: StrobePhotoMotionLab,
  },
  {
    name: physicsComponentNames.tickerTapeMotionLab,
    component: TickerTapeMotionLab,
  },
  {
    name: physicsComponentNames.trainPassengerRelativeLab,
    component: TrainPassengerRelativeLab,
  },
  {
    name: physicsComponentNames.uniformCircularMotionLab,
    component: UniformCircularMotionLab,
  },
  {
    name: physicsComponentNames.uniformLinearMotionLab,
    component: UniformLinearMotionLab,
  },
  {
    name: physicsComponentNames.vectorConceptLab,
    component: VectorConceptLab,
  },
  {
    name: physicsComponentNames.velocitySpeedLab,
    component: VelocitySpeedLab,
  },
  {
    name: physicsComponentNames.verticalMovementLab,
    component: VerticalMovementLab,
  },
  {
    name: physicsComponentNames.waveBuoyPowerLab,
    component: WaveBuoyPowerLab,
  },
  {
    name: physicsComponentNames.weightLampEnergyLab,
    component: WeightLampEnergyLab,
  },
  {
    name: physicsComponentNames.windEnergyConversionLab,
    component: WindEnergyConversionLab,
  },
  {
    name: physicsComponentNames.windRotorLab,
    component: WindRotorLab,
  },
] satisfies readonly RendererImplementation[];
