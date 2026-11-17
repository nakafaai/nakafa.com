import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  ApparentDepthLab,
  ConvexLensLab,
  GlassBlockLab,
  TelescopeLab,
} from "@/lib/content/renderer/client/physics/optics";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every light lab of physics, which any lesson in any domain may use. */
export const opticsRenderers = [
  {
    name: physicsComponentNames.apparentDepthLab,
    component: ApparentDepthLab,
  },
  {
    name: physicsComponentNames.convexLensLab,
    component: ConvexLensLab,
  },
  {
    name: physicsComponentNames.glassBlockLab,
    component: GlassBlockLab,
  },
  {
    name: physicsComponentNames.telescopeLab,
    component: TelescopeLab,
  },
] satisfies readonly RendererImplementation[];
