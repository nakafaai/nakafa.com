import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  LogicGateLab,
  RectifierDiodeLab,
  TransistorBiasLab,
  TransistorSwitchLab,
} from "@/lib/content/renderer/client/physics/electronics";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every electronics lab of physics, which any lesson in any domain may use. */
export const electronicsRenderers = [
  {
    name: physicsComponentNames.logicGateLab,
    component: LogicGateLab,
  },
  {
    name: physicsComponentNames.rectifierDiodeLab,
    component: RectifierDiodeLab,
  },
  {
    name: physicsComponentNames.transistorBiasLab,
    component: TransistorBiasLab,
  },
  {
    name: physicsComponentNames.transistorSwitchLab,
    component: TransistorSwitchLab,
  },
] satisfies readonly RendererImplementation[];
