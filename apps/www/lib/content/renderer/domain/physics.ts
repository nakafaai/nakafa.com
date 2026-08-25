import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: physicsComponentNames.accelerationGraphCard,
    load: () =>
      import("@/lib/content/renderer/client/physics/acceleration").then(
        ({ AccelerationGraphCard }) => AccelerationGraphCard
      ),
  },
  {
    name: physicsComponentNames.accelerationLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/acceleration").then(
        ({ AccelerationLab }) => AccelerationLab
      ),
  },
  {
    name: physicsComponentNames.averageVelocitySpeedLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/velocity").then(
        ({ AverageVelocitySpeedLab }) => AverageVelocitySpeedLab
      ),
  },
  {
    name: physicsComponentNames.dimensionLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/measurement").then(
        ({ DimensionLab }) => DimensionLab
      ),
  },
  {
    name: physicsComponentNames.displacementDistanceLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/distance").then(
        ({ DisplacementDistanceLab }) => DisplacementDistanceLab
      ),
  },
  {
    name: physicsComponentNames.instantaneousVelocitySpeedLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/velocity").then(
        ({ InstantaneousVelocitySpeedLab }) => InstantaneousVelocitySpeedLab
      ),
  },
  {
    name: physicsComponentNames.measurementToolsLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/measurement").then(
        ({ MeasurementToolsLab }) => MeasurementToolsLab
      ),
  },
  {
    name: physicsComponentNames.nonUniformLinearMotionGraphCard,
    load: () =>
      import("@/lib/content/renderer/client/physics/linear").then(
        ({ NonUniformLinearMotionGraphCard }) => NonUniformLinearMotionGraphCard
      ),
  },
  {
    name: physicsComponentNames.nonUniformLinearMotionLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/linear").then(
        ({ NonUniformLinearMotionLab }) => NonUniformLinearMotionLab
      ),
  },
  {
    name: physicsComponentNames.parabolicMovementAnalysisLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/parabolic").then(
        ({ ParabolicMovementAnalysisLab }) => ParabolicMovementAnalysisLab
      ),
  },
  {
    name: physicsComponentNames.parabolicMovementLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/parabolic").then(
        ({ ParabolicMovementLab }) => ParabolicMovementLab
      ),
  },
  {
    name: physicsComponentNames.relativeMovementLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/movement").then(
        ({ RelativeMovementLab }) => RelativeMovementLab
      ),
  },
  {
    name: physicsComponentNames.stoppingDistanceLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/distance").then(
        ({ StoppingDistanceLab }) => StoppingDistanceLab
      ),
  },
  {
    name: physicsComponentNames.uniformCircularMotionLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/circular").then(
        ({ UniformCircularMotionLab }) => UniformCircularMotionLab
      ),
  },
  {
    name: physicsComponentNames.uniformLinearMotionLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/linear").then(
        ({ UniformLinearMotionLab }) => UniformLinearMotionLab
      ),
  },
  {
    name: physicsComponentNames.vector3d,
    load: () =>
      import("@/lib/content/renderer/client/physics/vector").then(
        ({ Vector3d }) => Vector3d
      ),
  },
  {
    name: physicsComponentNames.vectorConceptLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/vector").then(
        ({ VectorConceptLab }) => VectorConceptLab
      ),
  },
  {
    name: physicsComponentNames.velocitySpeedLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/velocity").then(
        ({ VelocitySpeedLab }) => VelocitySpeedLab
      ),
  },
  {
    name: physicsComponentNames.verticalMovementLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/movement").then(
        ({ VerticalMovementLab }) => VerticalMovementLab
      ),
  },
  {
    name: physicsComponentNames.windEnergyConversionLab,
    load: () =>
      import("@/lib/content/renderer/client/physics/energy").then(
        ({ WindEnergyConversionLab }) => WindEnergyConversionLab
      ),
  },
] satisfies readonly RendererComponentLoader[];
