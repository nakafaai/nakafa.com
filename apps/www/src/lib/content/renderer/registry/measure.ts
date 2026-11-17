import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  MotionAreaLab,
  PendulumGraphLab,
  ReadingSpreadLab,
} from "@/lib/content/renderer/client/physics/measure";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every measurement lab of physics, which any lesson in any domain may use. */
export const measureRenderers = [
  {
    name: physicsComponentNames.motionAreaLab,
    component: MotionAreaLab,
  },
  {
    name: physicsComponentNames.pendulumGraphLab,
    component: PendulumGraphLab,
  },
  {
    name: physicsComponentNames.readingSpreadLab,
    component: ReadingSpreadLab,
  },
] satisfies readonly RendererImplementation[];
