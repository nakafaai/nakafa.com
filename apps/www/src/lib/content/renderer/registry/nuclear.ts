import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  FissionLab,
  HalfLifeCounterLab,
  NuclearBindingCurveLab,
  PhotoelectricLab,
} from "@/lib/content/renderer/client/physics/nuclear";
import {
  DeBroglieMatterWaveLab,
  PlanckBlackbodyLab,
} from "@/lib/content/renderer/client/physics/quantum";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every nuclear and quantum lab of physics, which any lesson in any domain may use. */
export const nuclearRenderers = [
  {
    name: physicsComponentNames.deBroglieMatterWaveLab,
    component: DeBroglieMatterWaveLab,
  },
  {
    name: physicsComponentNames.fissionLab,
    component: FissionLab,
  },
  {
    name: physicsComponentNames.halfLifeCounterLab,
    component: HalfLifeCounterLab,
  },
  {
    name: physicsComponentNames.nuclearBindingCurveLab,
    component: NuclearBindingCurveLab,
  },
  {
    name: physicsComponentNames.photoelectricLab,
    component: PhotoelectricLab,
  },
  {
    name: physicsComponentNames.planckBlackbodyLab,
    component: PlanckBlackbodyLab,
  },
] satisfies readonly RendererImplementation[];
