import { biologyComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  FlowerAnatomyLab,
  FruitSeedDispersalLab,
} from "@/lib/content/renderer/client/biology/flower";
import {
  CarnivorousPlantLab,
  MineralDeficiencyLab,
  RootHairUptakeLab,
} from "@/lib/content/renderer/client/biology/nutrition";
import {
  AuxinAgarBendLab,
  PhytohormoneActionLab,
} from "@/lib/content/renderer/client/biology/phytohormone";
import {
  PhloemTranslocationLab,
  PhytoremediationLab,
  XylemCohesionLab,
} from "@/lib/content/renderer/client/biology/vascular";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Plant nutrition, vascular transport, phytohormone, and reproduction labs. */
export const botanyRenderers = [
  {
    name: biologyComponentNames.auxinAgarBendLab,
    component: AuxinAgarBendLab,
  },
  {
    name: biologyComponentNames.carnivorousPlantLab,
    component: CarnivorousPlantLab,
  },
  {
    name: biologyComponentNames.flowerAnatomyLab,
    component: FlowerAnatomyLab,
  },
  {
    name: biologyComponentNames.fruitSeedDispersalLab,
    component: FruitSeedDispersalLab,
  },
  {
    name: biologyComponentNames.mineralDeficiencyLab,
    component: MineralDeficiencyLab,
  },
  {
    name: biologyComponentNames.phloemTranslocationLab,
    component: PhloemTranslocationLab,
  },
  {
    name: biologyComponentNames.phytohormoneActionLab,
    component: PhytohormoneActionLab,
  },
  {
    name: biologyComponentNames.phytoremediationLab,
    component: PhytoremediationLab,
  },
  {
    name: biologyComponentNames.rootHairUptakeLab,
    component: RootHairUptakeLab,
  },
  {
    name: biologyComponentNames.xylemCohesionLab,
    component: XylemCohesionLab,
  },
] satisfies readonly RendererImplementation[];
