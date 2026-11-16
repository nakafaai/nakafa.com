import { biologyComponentNames } from "@repo/design-system/lib/markdown/names";
import { BacteriaStructureLab } from "@/lib/content/renderer/client/biology/bacteria";
import {
  CellCutawayLab,
  CellScaleLab,
  DnaHelixLab,
} from "@/lib/content/renderer/client/biology/cells";
import {
  CarbonBudgetLab,
  ClimateObservationLab,
  CoralBleachLab,
  GreenhouseEffectLab,
  SeaLevelRiseLab,
} from "@/lib/content/renderer/client/biology/climate";
import { PredatorPreyLab } from "@/lib/content/renderer/client/biology/ecology";
import {
  FungiMyceliumLab,
  HyphaeDecayLab,
} from "@/lib/content/renderer/client/biology/fungi";
import {
  BinaryFissionLab,
  ChemotaxisLab,
  GramStainLab,
  YogurtLab,
} from "@/lib/content/renderer/client/biology/microbes";
import { SarsCov2VirionLab } from "@/lib/content/renderer/client/biology/virion";
import {
  AntibodyNeutralizeLab,
  EpidemicSpreadLab,
  VirusMorphologyLab,
  VirusReplicationLab,
  VirusRoleLab,
  VirusStructureLab,
} from "@/lib/content/renderer/client/biology/virus";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every biology visual, which any lesson in any domain may use. */
export const biologyRenderers = [
  {
    name: biologyComponentNames.binaryFissionLab,
    component: BinaryFissionLab,
  },
  {
    name: biologyComponentNames.chemotaxisLab,
    component: ChemotaxisLab,
  },
  {
    name: biologyComponentNames.gramStainLab,
    component: GramStainLab,
  },
  {
    name: biologyComponentNames.yogurtLab,
    component: YogurtLab,
  },
  {
    name: biologyComponentNames.bacteriaStructureLab,
    component: BacteriaStructureLab,
  },
  {
    name: biologyComponentNames.climateObservationLab,
    component: ClimateObservationLab,
  },
  {
    name: biologyComponentNames.fungiMyceliumLab,
    component: FungiMyceliumLab,
  },
  {
    name: biologyComponentNames.greenhouseEffectLab,
    component: GreenhouseEffectLab,
  },
  {
    name: biologyComponentNames.sarsCov2VirionLab,
    component: SarsCov2VirionLab,
  },
  {
    name: biologyComponentNames.virusMorphologyLab,
    component: VirusMorphologyLab,
  },
  {
    name: biologyComponentNames.virusReplicationLab,
    component: VirusReplicationLab,
  },
  {
    name: biologyComponentNames.virusRoleLab,
    component: VirusRoleLab,
  },
  {
    name: biologyComponentNames.virusStructureLab,
    component: VirusStructureLab,
  },
  {
    name: biologyComponentNames.antibodyNeutralizeLab,
    component: AntibodyNeutralizeLab,
  },
  {
    name: biologyComponentNames.carbonBudgetLab,
    component: CarbonBudgetLab,
  },
  {
    name: biologyComponentNames.cellCutawayLab,
    component: CellCutawayLab,
  },
  {
    name: biologyComponentNames.cellScaleLab,
    component: CellScaleLab,
  },
  {
    name: biologyComponentNames.coralBleachLab,
    component: CoralBleachLab,
  },
  {
    name: biologyComponentNames.dnaHelixLab,
    component: DnaHelixLab,
  },
  {
    name: biologyComponentNames.epidemicSpreadLab,
    component: EpidemicSpreadLab,
  },
  {
    name: biologyComponentNames.hyphaeDecayLab,
    component: HyphaeDecayLab,
  },
  {
    name: biologyComponentNames.predatorPreyLab,
    component: PredatorPreyLab,
  },
  {
    name: biologyComponentNames.seaLevelRiseLab,
    component: SeaLevelRiseLab,
  },
] satisfies readonly RendererImplementation[];
