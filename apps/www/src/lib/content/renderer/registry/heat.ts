import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  GasPistonLab,
  HeatingCurveLab,
  IceMeltingLab,
} from "@/lib/content/renderer/client/physics/heat";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every heat lab of physics, which any lesson in any domain may use. */
export const heatRenderers = [
  {
    name: physicsComponentNames.gasPistonLab,
    component: GasPistonLab,
  },
  {
    name: physicsComponentNames.heatingCurveLab,
    component: HeatingCurveLab,
  },
  {
    name: physicsComponentNames.iceMeltingLab,
    component: IceMeltingLab,
  },
] satisfies readonly RendererImplementation[];
