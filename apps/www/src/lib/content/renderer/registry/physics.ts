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
import { WindEnergyConversionLab } from "@/lib/content/renderer/client/physics/energy";
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
import {
  ParabolicMovementAnalysisLab,
  ParabolicMovementLab,
} from "@/lib/content/renderer/client/physics/parabolic";
import { StreetOriginPositionLab } from "@/lib/content/renderer/client/physics/street";
import { StrobePhotoMotionLab } from "@/lib/content/renderer/client/physics/strobe";
import { TickerTapeMotionLab } from "@/lib/content/renderer/client/physics/ticker";
import { SpeedTrapInstantSpeedLab } from "@/lib/content/renderer/client/physics/trap";
import { CarTripAverageVelocityLab } from "@/lib/content/renderer/client/physics/trip";
import { VectorConceptLab } from "@/lib/content/renderer/client/physics/vector";
import {
  AverageVelocitySpeedLab,
  InstantaneousVelocitySpeedLab,
  VelocitySpeedLab,
} from "@/lib/content/renderer/client/physics/velocity";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every physics visual, which any lesson in any domain may use. */
export const physicsRenderers = [
  {
    name: physicsComponentNames.brakeHeatLab,
    component: BrakeHeatLab,
  },
  {
    name: physicsComponentNames.brakingSurfaceLab,
    component: BrakingSurfaceLab,
  },
  {
    name: physicsComponentNames.followingDistanceLab,
    component: FollowingDistanceLab,
  },
  {
    name: physicsComponentNames.reactionTimeLab,
    component: ReactionTimeLab,
  },
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
    name: physicsComponentNames.dimensionLab,
    component: DimensionLab,
  },
  {
    name: physicsComponentNames.displacementDistanceLab,
    component: DisplacementDistanceLab,
  },
  {
    name: physicsComponentNames.instantaneousVelocitySpeedLab,
    component: InstantaneousVelocitySpeedLab,
  },
  {
    name: physicsComponentNames.measurementToolsLab,
    component: MeasurementToolsLab,
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
    name: physicsComponentNames.relativeMovementLab,
    component: RelativeMovementLab,
  },
  {
    name: physicsComponentNames.stoppingDistanceLab,
    component: StoppingDistanceLab,
  },
  {
    name: physicsComponentNames.tickerTapeMotionLab,
    component: TickerTapeMotionLab,
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
    name: physicsComponentNames.windEnergyConversionLab,
    component: WindEnergyConversionLab,
  },
  {
    name: physicsComponentNames.carTripAverageVelocityLab,
    component: CarTripAverageVelocityLab,
  },
  {
    name: physicsComponentNames.speedTrapInstantSpeedLab,
    component: SpeedTrapInstantSpeedLab,
  },
  {
    name: physicsComponentNames.streetOriginPositionLab,
    component: StreetOriginPositionLab,
  },
  {
    name: physicsComponentNames.strobePhotoMotionLab,
    component: StrobePhotoMotionLab,
  },
] satisfies readonly RendererImplementation[];
