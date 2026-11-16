import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  FissionLab,
  HalfLifeCounterLab,
  PhotoelectricLab,
} from "@/lib/content/renderer/client/physics/nuclear";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every nuclear and quantum lab of physics, which any lesson in any domain may use. */
export const nuclearRenderers = [
  {
    name: physicsComponentNames.fissionLab,
    component: FissionLab,
  },
  {
    name: physicsComponentNames.halfLifeCounterLab,
    component: HalfLifeCounterLab,
  },
  {
    name: physicsComponentNames.photoelectricLab,
    component: PhotoelectricLab,
  },
] satisfies readonly RendererImplementation[];
