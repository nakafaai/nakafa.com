import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  KeplerOrbitPeriodLab,
  OrbitRadiusLab,
  PlanetCompareLab,
} from "@/lib/content/renderer/client/physics/gravity";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every gravitation lab of physics, which any lesson in any domain may use. */
export const gravityRenderers = [
  {
    name: physicsComponentNames.keplerOrbitPeriodLab,
    component: KeplerOrbitPeriodLab,
  },
  {
    name: physicsComponentNames.orbitRadiusLab,
    component: OrbitRadiusLab,
  },
  {
    name: physicsComponentNames.planetCompareLab,
    component: PlanetCompareLab,
  },
] satisfies readonly RendererImplementation[];
