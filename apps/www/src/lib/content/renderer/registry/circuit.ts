import { physicsComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  BulbNetworkLab,
  HeaterSupplyLab,
  InternalResistanceLab,
  WireResistanceLab,
} from "@/lib/content/renderer/client/physics/circuit";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every circuit lab of physics, which any lesson in any domain may use. */
export const circuitRenderers = [
  {
    name: physicsComponentNames.bulbNetworkLab,
    component: BulbNetworkLab,
  },
  {
    name: physicsComponentNames.heaterSupplyLab,
    component: HeaterSupplyLab,
  },
  {
    name: physicsComponentNames.internalResistanceLab,
    component: InternalResistanceLab,
  },
  {
    name: physicsComponentNames.wireResistanceLab,
    component: WireResistanceLab,
  },
] satisfies readonly RendererImplementation[];
