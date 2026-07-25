import { BacteriaStructureLab } from "@repo/design-system/components/contents/biology/bacteria";
import { GreenhouseEffectLab } from "@repo/design-system/components/contents/biology/climate-greenhouse";
import { ClimateObservationLab } from "@repo/design-system/components/contents/biology/climate-observation";
import { FungiMyceliumLab } from "@repo/design-system/components/contents/biology/fungi";
import { SarsCov2VirionLab } from "@repo/design-system/components/contents/biology/sars-cov-2-virion";
import { VirusReplicationLab } from "@repo/design-system/components/contents/biology/virus-replication";
import { VirusRoleLab } from "@repo/design-system/components/contents/biology/virus-role";
import {
  VirusMorphologyLab,
  VirusStructureLab,
} from "@repo/design-system/components/contents/biology/virus-structure";
import { biologyComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by biology routes. */
export const biologyRegistry = {
  [biologyComponentNames.bacteriaStructureLab]: BacteriaStructureLab,
  [biologyComponentNames.climateObservationLab]: ClimateObservationLab,
  [biologyComponentNames.fungiMyceliumLab]: FungiMyceliumLab,
  [biologyComponentNames.greenhouseEffectLab]: GreenhouseEffectLab,
  [biologyComponentNames.sarsCov2VirionLab]: SarsCov2VirionLab,
  [biologyComponentNames.virusMorphologyLab]: VirusMorphologyLab,
  [biologyComponentNames.virusReplicationLab]: VirusReplicationLab,
  [biologyComponentNames.virusRoleLab]: VirusRoleLab,
  [biologyComponentNames.virusStructureLab]: VirusStructureLab,
} satisfies MDXComponents;

/** Complete renderer used only by biology routes. */
export const biologyComponents: MDXComponents = {
  ...mdxComponents,
  ...biologyRegistry,
};
