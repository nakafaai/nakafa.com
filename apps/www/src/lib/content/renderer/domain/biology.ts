import { biologyComponentNames } from "@repo/design-system/lib/markdown/names";
import { BacteriaStructureLab } from "@/lib/content/renderer/client/biology/bacteria";
import {
  ClimateObservationLab,
  GreenhouseEffectLab,
} from "@/lib/content/renderer/client/biology/climate";
import { FungiMyceliumLab } from "@/lib/content/renderer/client/biology/fungi";
import { SarsCov2VirionLab } from "@/lib/content/renderer/client/biology/virion";
import {
  VirusMorphologyLab,
  VirusReplicationLab,
  VirusRoleLab,
  VirusStructureLab,
} from "@/lib/content/renderer/client/biology/virus";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

export const domainRenderers = [
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
] satisfies readonly RendererImplementation[];
