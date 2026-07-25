import { Vector3d } from "@repo/design-system/components/contents/mathematics/vector-3d";
import { AccelerationGraphCard } from "@repo/design-system/components/contents/physics/kinematics/acceleration/chart-card";
import { AccelerationLab } from "@repo/design-system/components/contents/physics/kinematics/acceleration/lab";
import { AverageVelocitySpeedLab } from "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/lab";
import { DisplacementDistanceLab } from "@repo/design-system/components/contents/physics/kinematics/displacement-distance/lab";
import { InstantaneousVelocitySpeedLab } from "@repo/design-system/components/contents/physics/kinematics/instantaneous-velocity-speed/lab";
import { NonUniformLinearMotionGraphCard } from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/chart-card";
import { NonUniformLinearMotionLab } from "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/lab";
import { ParabolicMovementLab } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/lab";
import { ParabolicMovementAnalysisLab } from "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/lab";
import { RelativeMovementLab } from "@repo/design-system/components/contents/physics/kinematics/relative-movement/lab";
import { StoppingDistanceLab } from "@repo/design-system/components/contents/physics/kinematics/stopping-distance/lab";
import { UniformCircularMotionLab } from "@repo/design-system/components/contents/physics/kinematics/uniform-circular-motion/lab";
import { UniformLinearMotionLab } from "@repo/design-system/components/contents/physics/kinematics/uniform-linear-motion/lab";
import { VelocitySpeedLab } from "@repo/design-system/components/contents/physics/kinematics/velocity-speed/lab";
import { VerticalMovementLab } from "@repo/design-system/components/contents/physics/kinematics/vertical-movement/lab";
import { DimensionLab } from "@repo/design-system/components/contents/physics/measurement/dimension/lab";
import { MeasurementToolsLab } from "@repo/design-system/components/contents/physics/measurement/tools/lab";
import { WindEnergyConversionLab } from "@repo/design-system/components/contents/physics/renewable-energy/wind-conversion/lab";
import { VectorConceptLab } from "@repo/design-system/components/contents/physics/vector/concept/lab";
import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by physics routes. */
export const physicsRegistry = {
  [physicsComponentNames.accelerationGraphCard]: AccelerationGraphCard,
  [physicsComponentNames.accelerationLab]: AccelerationLab,
  [physicsComponentNames.averageVelocitySpeedLab]: AverageVelocitySpeedLab,
  [physicsComponentNames.dimensionLab]: DimensionLab,
  [physicsComponentNames.displacementDistanceLab]: DisplacementDistanceLab,
  [physicsComponentNames.instantaneousVelocitySpeedLab]:
    InstantaneousVelocitySpeedLab,
  [physicsComponentNames.measurementToolsLab]: MeasurementToolsLab,
  [physicsComponentNames.nonUniformLinearMotionGraphCard]:
    NonUniformLinearMotionGraphCard,
  [physicsComponentNames.nonUniformLinearMotionLab]: NonUniformLinearMotionLab,
  [physicsComponentNames.parabolicMovementAnalysisLab]:
    ParabolicMovementAnalysisLab,
  [physicsComponentNames.parabolicMovementLab]: ParabolicMovementLab,
  [physicsComponentNames.relativeMovementLab]: RelativeMovementLab,
  [physicsComponentNames.stoppingDistanceLab]: StoppingDistanceLab,
  [physicsComponentNames.uniformCircularMotionLab]: UniformCircularMotionLab,
  [physicsComponentNames.uniformLinearMotionLab]: UniformLinearMotionLab,
  [physicsComponentNames.vector3d]: Vector3d,
  [physicsComponentNames.vectorConceptLab]: VectorConceptLab,
  [physicsComponentNames.velocitySpeedLab]: VelocitySpeedLab,
  [physicsComponentNames.verticalMovementLab]: VerticalMovementLab,
  [physicsComponentNames.windEnergyConversionLab]: WindEnergyConversionLab,
} satisfies MDXComponents;

/** Complete renderer used only by physics routes. */
export const physicsComponents: MDXComponents = {
  ...mdxComponents,
  ...physicsRegistry,
};
