import { biologyComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: biologyComponentNames.bacteriaStructureLab,
    load: () =>
      import("@/lib/content/renderer/client/biology").then(
        ({ LazyBacteriaStructureLab }) => LazyBacteriaStructureLab
      ),
  },
  {
    name: biologyComponentNames.climateObservationLab,
    load: () =>
      import("@/lib/content/renderer/client/biology").then(
        ({ LazyClimateObservationLab }) => LazyClimateObservationLab
      ),
  },
  {
    name: biologyComponentNames.fungiMyceliumLab,
    load: () =>
      import("@/lib/content/renderer/client/biology").then(
        ({ LazyFungiMyceliumLab }) => LazyFungiMyceliumLab
      ),
  },
  {
    name: biologyComponentNames.greenhouseEffectLab,
    load: () =>
      import("@/lib/content/renderer/client/biology").then(
        ({ LazyGreenhouseEffectLab }) => LazyGreenhouseEffectLab
      ),
  },
  {
    name: biologyComponentNames.sarsCov2VirionLab,
    load: () =>
      import("@/lib/content/renderer/client/biology").then(
        ({ LazySarsCov2VirionLab }) => LazySarsCov2VirionLab
      ),
  },
  {
    name: biologyComponentNames.virusMorphologyLab,
    load: () =>
      import("@/lib/content/renderer/client/biology").then(
        ({ LazyVirusMorphologyLab }) => LazyVirusMorphologyLab
      ),
  },
  {
    name: biologyComponentNames.virusReplicationLab,
    load: () =>
      import("@/lib/content/renderer/client/biology").then(
        ({ LazyVirusReplicationLab }) => LazyVirusReplicationLab
      ),
  },
  {
    name: biologyComponentNames.virusRoleLab,
    load: () =>
      import("@/lib/content/renderer/client/biology").then(
        ({ LazyVirusRoleLab }) => LazyVirusRoleLab
      ),
  },
  {
    name: biologyComponentNames.virusStructureLab,
    load: () =>
      import("@/lib/content/renderer/client/biology").then(
        ({ LazyVirusStructureLab }) => LazyVirusStructureLab
      ),
  },
] satisfies readonly RendererComponentLoader[];
