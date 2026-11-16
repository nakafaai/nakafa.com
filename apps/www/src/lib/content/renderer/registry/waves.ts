import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  DoubleSlitLab,
  EchoLab,
  RippleTankLab,
  SpeakerInterferenceLab,
} from "@/lib/content/renderer/client/physics/waves";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every wave lab of physics, which any lesson in any domain may use. */
export const wavesRenderers = [
  {
    name: physicsComponentNames.doubleSlitLab,
    component: DoubleSlitLab,
  },
  {
    name: physicsComponentNames.echoLab,
    component: EchoLab,
  },
  {
    name: physicsComponentNames.rippleTankLab,
    component: RippleTankLab,
  },
  {
    name: physicsComponentNames.speakerInterferenceLab,
    component: SpeakerInterferenceLab,
  },
] satisfies readonly RendererImplementation[];
