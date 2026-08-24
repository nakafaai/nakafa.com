"use client";

import dynamic from "next/dynamic";

export const LazyAccelerationGraphCard = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/acceleration/chart-card"
  ).then(({ AccelerationGraphCard }) => AccelerationGraphCard)
);
export const LazyAccelerationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/acceleration/lab"
  ).then(({ AccelerationLab }) => AccelerationLab)
);
export const LazyAverageVelocitySpeedLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/average-velocity-speed/lab"
  ).then(({ AverageVelocitySpeedLab }) => AverageVelocitySpeedLab)
);
export const LazyDisplacementDistanceLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/displacement-distance/lab"
  ).then(({ DisplacementDistanceLab }) => DisplacementDistanceLab)
);
export const LazyInstantaneousVelocitySpeedLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/instantaneous-velocity-speed/lab"
  ).then(({ InstantaneousVelocitySpeedLab }) => InstantaneousVelocitySpeedLab)
);
export const LazyNonUniformLinearMotionGraphCard = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/chart-card"
  ).then(
    ({ NonUniformLinearMotionGraphCard }) => NonUniformLinearMotionGraphCard
  )
);
export const LazyNonUniformLinearMotionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/non-uniform-linear-motion/lab"
  ).then(({ NonUniformLinearMotionLab }) => NonUniformLinearMotionLab)
);
export const LazyParabolicMovementLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/parabolic-movement/lab"
  ).then(({ ParabolicMovementLab }) => ParabolicMovementLab)
);
export const LazyParabolicMovementAnalysisLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/parabolic-movement-analysis/lab"
  ).then(({ ParabolicMovementAnalysisLab }) => ParabolicMovementAnalysisLab)
);
export const LazyRelativeMovementLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/relative-movement/lab"
  ).then(({ RelativeMovementLab }) => RelativeMovementLab)
);
export const LazyStoppingDistanceLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/stopping-distance/lab"
  ).then(({ StoppingDistanceLab }) => StoppingDistanceLab)
);
export const LazyUniformCircularMotionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/uniform-circular-motion/lab"
  ).then(({ UniformCircularMotionLab }) => UniformCircularMotionLab)
);
export const LazyUniformLinearMotionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/uniform-linear-motion/lab"
  ).then(({ UniformLinearMotionLab }) => UniformLinearMotionLab)
);
export const LazyVelocitySpeedLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/velocity-speed/lab"
  ).then(({ VelocitySpeedLab }) => VelocitySpeedLab)
);
export const LazyVerticalMovementLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/kinematics/vertical-movement/lab"
  ).then(({ VerticalMovementLab }) => VerticalMovementLab)
);
export const LazyDimensionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/measurement/dimension/lab"
  ).then(({ DimensionLab }) => DimensionLab)
);
export const LazyMeasurementToolsLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/measurement/tools/lab"
  ).then(({ MeasurementToolsLab }) => MeasurementToolsLab)
);
export const LazyWindEnergyConversionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/renewable-energy/wind-conversion/lab"
  ).then(({ WindEnergyConversionLab }) => WindEnergyConversionLab)
);
export const LazyVectorConceptLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/physics/vector/concept/lab"
  ).then(({ VectorConceptLab }) => VectorConceptLab)
);
