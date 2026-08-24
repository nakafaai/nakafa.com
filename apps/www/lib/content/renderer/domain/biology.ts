import { biologyComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: biologyComponentNames.bacteriaStructureLab,
    load: () =>
      import("@/lib/content/renderer/client/biology/bacteria").then(
        ({ BacteriaStructureLab }) => BacteriaStructureLab
      ),
  },
  {
    name: biologyComponentNames.climateObservationLab,
    load: () =>
      import("@/lib/content/renderer/client/biology/climate").then(
        ({ ClimateObservationLab }) => ClimateObservationLab
      ),
  },
  {
    name: biologyComponentNames.fungiMyceliumLab,
    load: () =>
      import("@/lib/content/renderer/client/biology/fungi").then(
        ({ FungiMyceliumLab }) => FungiMyceliumLab
      ),
  },
  {
    name: biologyComponentNames.greenhouseEffectLab,
    load: () =>
      import("@/lib/content/renderer/client/biology/climate").then(
        ({ GreenhouseEffectLab }) => GreenhouseEffectLab
      ),
  },
  {
    name: biologyComponentNames.sarsCov2VirionLab,
    load: () =>
      import("@/lib/content/renderer/client/biology/virion").then(
        ({ SarsCov2VirionLab }) => SarsCov2VirionLab
      ),
  },
  {
    name: biologyComponentNames.virusMorphologyLab,
    load: () =>
      import("@/lib/content/renderer/client/biology/virus").then(
        ({ VirusMorphologyLab }) => VirusMorphologyLab
      ),
  },
  {
    name: biologyComponentNames.virusReplicationLab,
    load: () =>
      import("@/lib/content/renderer/client/biology/virus").then(
        ({ VirusReplicationLab }) => VirusReplicationLab
      ),
  },
  {
    name: biologyComponentNames.virusRoleLab,
    load: () =>
      import("@/lib/content/renderer/client/biology/virus").then(
        ({ VirusRoleLab }) => VirusRoleLab
      ),
  },
  {
    name: biologyComponentNames.virusStructureLab,
    load: () =>
      import("@/lib/content/renderer/client/biology/virus").then(
        ({ VirusStructureLab }) => VirusStructureLab
      ),
  },
] satisfies readonly RendererComponentLoader[];
