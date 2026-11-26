import { mathematicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  DerivativeSlopeFieldLab,
  OptimizationBox3DLab,
  SecantToTangentLab,
} from "@/lib/content/renderer/client/mathematics/derivative";
import {
  AreaBetweenCurvesLab,
  RiemannSumConvergenceLab,
  SolidOfRevolutionLab,
} from "@/lib/content/renderer/client/mathematics/integral";
import {
  AsymptoteBehaviorLab,
  EpsilonDeltaBandLab,
  SqueezeTheoremWaveLab,
} from "@/lib/content/renderer/client/mathematics/limit";
import {
  EigenTransform3DLab,
  PcaProjection3DLab,
  QrGramSchmidt3DLab,
} from "@/lib/content/renderer/client/mathematics/linear";
import {
  DotProductProjection3DLab,
  Vector3DCrossProductLab,
  VectorParallelepipedLab,
} from "@/lib/content/renderer/client/mathematics/vector";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Calculus, linear methods, and 3D vector geometry labs. */
export const calculusRenderers = [
  {
    name: mathematicsComponentNames.areaBetweenCurvesLab,
    component: AreaBetweenCurvesLab,
  },
  {
    name: mathematicsComponentNames.asymptoteBehaviorLab,
    component: AsymptoteBehaviorLab,
  },
  {
    name: mathematicsComponentNames.derivativeSlopeFieldLab,
    component: DerivativeSlopeFieldLab,
  },
  {
    name: mathematicsComponentNames.dotProductProjection3DLab,
    component: DotProductProjection3DLab,
  },
  {
    name: mathematicsComponentNames.eigenTransform3DLab,
    component: EigenTransform3DLab,
  },
  {
    name: mathematicsComponentNames.epsilonDeltaBandLab,
    component: EpsilonDeltaBandLab,
  },
  {
    name: mathematicsComponentNames.optimizationBox3DLab,
    component: OptimizationBox3DLab,
  },
  {
    name: mathematicsComponentNames.pcaProjection3DLab,
    component: PcaProjection3DLab,
  },
  {
    name: mathematicsComponentNames.qrGramSchmidt3DLab,
    component: QrGramSchmidt3DLab,
  },
  {
    name: mathematicsComponentNames.riemannSumConvergenceLab,
    component: RiemannSumConvergenceLab,
  },
  {
    name: mathematicsComponentNames.secantToTangentLab,
    component: SecantToTangentLab,
  },
  {
    name: mathematicsComponentNames.solidOfRevolutionLab,
    component: SolidOfRevolutionLab,
  },
  {
    name: mathematicsComponentNames.squeezeTheoremWaveLab,
    component: SqueezeTheoremWaveLab,
  },
  {
    name: mathematicsComponentNames.vector3DCrossProductLab,
    component: Vector3DCrossProductLab,
  },
  {
    name: mathematicsComponentNames.vectorParallelepipedLab,
    component: VectorParallelepipedLab,
  },
] satisfies readonly RendererImplementation[];
