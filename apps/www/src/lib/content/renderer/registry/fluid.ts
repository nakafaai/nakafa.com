import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  FloatingBlockLab,
  HydraulicJackLab,
  ManometerLab,
  VenturiTubeLab,
} from "@/lib/content/renderer/client/physics/fluid";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every fluid lab of physics, which any lesson in any domain may use. */
export const fluidRenderers = [
  {
    name: physicsComponentNames.floatingBlockLab,
    component: FloatingBlockLab,
  },
  {
    name: physicsComponentNames.hydraulicJackLab,
    component: HydraulicJackLab,
  },
  {
    name: physicsComponentNames.manometerLab,
    component: ManometerLab,
  },
  {
    name: physicsComponentNames.venturiTubeLab,
    component: VenturiTubeLab,
  },
] satisfies readonly RendererImplementation[];
