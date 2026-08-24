import { chemistryComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: chemistryComponentNames.ancientAtomLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyAncientAtomLab }) => LazyAncientAtomLab
      ),
  },
  {
    name: chemistryComponentNames.atomShellLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyAtomShellLab }) => LazyAtomShellLab
      ),
  },
  {
    name: chemistryComponentNames.atomSymbolLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyAtomSymbolLab }) => LazyAtomSymbolLab
      ),
  },
  {
    name: chemistryComponentNames.chemicalReactionCharacteristicsLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyChemicalReactionCharacteristicsLab }) =>
          LazyChemicalReactionCharacteristicsLab
      ),
  },
  {
    name: chemistryComponentNames.chemicalReactionTypesLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyChemicalReactionTypesLab }) => LazyChemicalReactionTypesLab
      ),
  },
  {
    name: chemistryComponentNames.combiningVolumesLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyCombiningVolumesLab }) => LazyCombiningVolumesLab
      ),
  },
  {
    name: chemistryComponentNames.constantCompositionLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyConstantCompositionLab }) => LazyConstantCompositionLab
      ),
  },
  {
    name: chemistryComponentNames.daltonEvidenceLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyDaltonEvidenceLab }) => LazyDaltonEvidenceLab
      ),
  },
  {
    name: chemistryComponentNames.electronConfigurationLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyElectronConfigurationLab }) => LazyElectronConfigurationLab
      ),
  },
  {
    name: chemistryComponentNames.ionLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyIonLab }) => LazyIonLab
      ),
  },
  {
    name: chemistryComponentNames.isotopeLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyIsotopeLab }) => LazyIsotopeLab
      ),
  },
  {
    name: chemistryComponentNames.massConservationLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyMassConservationLab }) => LazyMassConservationLab
      ),
  },
  {
    name: chemistryComponentNames.matterParticleReaderLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyMatterParticleReaderLab }) => LazyMatterParticleReaderLab
      ),
  },
  {
    name: chemistryComponentNames.methaneCombustionEquationLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyMethaneCombustionEquationLab }) =>
          LazyMethaneCombustionEquationLab
      ),
  },
  {
    name: chemistryComponentNames.modernPeriodicTableLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyModernPeriodicTableLab }) => LazyModernPeriodicTableLab
      ),
  },
  {
    name: chemistryComponentNames.multipleProportionsLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyMultipleProportionsLab }) => LazyMultipleProportionsLab
      ),
  },
  {
    name: chemistryComponentNames.periodicPropertiesLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyPeriodicPropertiesLab }) => LazyPeriodicPropertiesLab
      ),
  },
  {
    name: chemistryComponentNames.subatomicParticlePropertiesLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazySubatomicParticlePropertiesLab }) =>
          LazySubatomicParticlePropertiesLab
      ),
  },
  {
    name: chemistryComponentNames.subatomicParticlesLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazySubatomicParticlesLab }) => LazySubatomicParticlesLab
      ),
  },
  {
    name: chemistryComponentNames.valenceElectronLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry").then(
        ({ LazyValenceElectronLab }) => LazyValenceElectronLab
      ),
  },
] satisfies readonly RendererComponentLoader[];
