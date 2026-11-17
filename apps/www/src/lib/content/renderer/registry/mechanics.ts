import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  BulletBlockLab,
  CliffThrowLab,
  ConnectedBlocksLab,
  InclineSlideLab,
  LiftScaleLab,
  RecoilLab,
  SpringChainLab,
} from "@/lib/content/renderer/client/physics/mechanics";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every mechanics lab of physics, which any lesson in any domain may use. */
export const mechanicsRenderers = [
  {
    name: physicsComponentNames.bulletBlockLab,
    component: BulletBlockLab,
  },
  {
    name: physicsComponentNames.cliffThrowLab,
    component: CliffThrowLab,
  },
  {
    name: physicsComponentNames.connectedBlocksLab,
    component: ConnectedBlocksLab,
  },
  {
    name: physicsComponentNames.inclineSlideLab,
    component: InclineSlideLab,
  },
  {
    name: physicsComponentNames.liftScaleLab,
    component: LiftScaleLab,
  },
  {
    name: physicsComponentNames.recoilLab,
    component: RecoilLab,
  },
  {
    name: physicsComponentNames.springChainLab,
    component: SpringChainLab,
  },
] satisfies readonly RendererImplementation[];
