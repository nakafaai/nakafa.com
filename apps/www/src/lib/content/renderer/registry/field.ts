import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  CurrentBalanceLab,
  MagnetPipeLab,
  TransformerLab,
} from "@/lib/content/renderer/client/physics/field";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every field lab of physics, which any lesson in any domain may use. */
export const fieldRenderers = [
  {
    name: physicsComponentNames.currentBalanceLab,
    component: CurrentBalanceLab,
  },
  {
    name: physicsComponentNames.magnetPipeLab,
    component: MagnetPipeLab,
  },
  {
    name: physicsComponentNames.transformerLab,
    component: TransformerLab,
  },
] satisfies readonly RendererImplementation[];
