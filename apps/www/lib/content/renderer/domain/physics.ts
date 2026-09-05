import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  AccelerationGraphCard,
  AccelerationLab,
} from "@/lib/content/renderer/client/physics/acceleration";
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
import {
  Vector3d,
  VectorConceptLab,
} from "@/lib/content/renderer/client/physics/vector";
import {
  AverageVelocitySpeedLab,
  InstantaneousVelocitySpeedLab,
  VelocitySpeedLab,
} from "@/lib/content/renderer/client/physics/velocity";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
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
    name: physicsComponentNames.uniformCircularMotionLab,
    component: UniformCircularMotionLab,
  },
  {
    name: physicsComponentNames.uniformLinearMotionLab,
    component: UniformLinearMotionLab,
  },
  {
    name: physicsComponentNames.vector3d,
    component: Vector3d,
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
] satisfies readonly RendererImplementation[];
