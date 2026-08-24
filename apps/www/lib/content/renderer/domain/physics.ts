import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: physicsComponentNames.accelerationGraphCard,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyAccelerationGraphCard }) => LazyAccelerationGraphCard
      ),
  },
  {
    name: physicsComponentNames.accelerationLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyAccelerationLab }) => LazyAccelerationLab
      ),
  },
  {
    name: physicsComponentNames.averageVelocitySpeedLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyAverageVelocitySpeedLab }) => LazyAverageVelocitySpeedLab
      ),
  },
  {
    name: physicsComponentNames.dimensionLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyDimensionLab }) => LazyDimensionLab
      ),
  },
  {
    name: physicsComponentNames.displacementDistanceLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyDisplacementDistanceLab }) => LazyDisplacementDistanceLab
      ),
  },
  {
    name: physicsComponentNames.instantaneousVelocitySpeedLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyInstantaneousVelocitySpeedLab }) =>
          LazyInstantaneousVelocitySpeedLab
      ),
  },
  {
    name: physicsComponentNames.measurementToolsLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyMeasurementToolsLab }) => LazyMeasurementToolsLab
      ),
  },
  {
    name: physicsComponentNames.nonUniformLinearMotionGraphCard,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyNonUniformLinearMotionGraphCard }) =>
          LazyNonUniformLinearMotionGraphCard
      ),
  },
  {
    name: physicsComponentNames.nonUniformLinearMotionLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyNonUniformLinearMotionLab }) => LazyNonUniformLinearMotionLab
      ),
  },
  {
    name: physicsComponentNames.parabolicMovementAnalysisLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyParabolicMovementAnalysisLab }) =>
          LazyParabolicMovementAnalysisLab
      ),
  },
  {
    name: physicsComponentNames.parabolicMovementLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyParabolicMovementLab }) => LazyParabolicMovementLab
      ),
  },
  {
    name: physicsComponentNames.relativeMovementLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyRelativeMovementLab }) => LazyRelativeMovementLab
      ),
  },
  {
    name: physicsComponentNames.stoppingDistanceLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyStoppingDistanceLab }) => LazyStoppingDistanceLab
      ),
  },
  {
    name: physicsComponentNames.uniformCircularMotionLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyUniformCircularMotionLab }) => LazyUniformCircularMotionLab
      ),
  },
  {
    name: physicsComponentNames.uniformLinearMotionLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyUniformLinearMotionLab }) => LazyUniformLinearMotionLab
      ),
  },
  {
    name: physicsComponentNames.vector3d,
    load: () =>
      import(
        "@repo/design-system/components/contents/mathematics/vector-3d"
      ).then(({ Vector3d }) => Vector3d),
  },
  {
    name: physicsComponentNames.vectorConceptLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyVectorConceptLab }) => LazyVectorConceptLab
      ),
  },
  {
    name: physicsComponentNames.velocitySpeedLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyVelocitySpeedLab }) => LazyVelocitySpeedLab
      ),
  },
  {
    name: physicsComponentNames.verticalMovementLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyVerticalMovementLab }) => LazyVerticalMovementLab
      ),
  },
  {
    name: physicsComponentNames.windEnergyConversionLab,
    load: () =>
      import("@/lib/content/renderer/client/physics").then(
        ({ LazyWindEnergyConversionLab }) => LazyWindEnergyConversionLab
      ),
  },
] satisfies readonly RendererComponentLoader[];
