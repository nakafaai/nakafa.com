import { chemistryComponentNames } from "@repo/design-system/lib/markdown/names";
import type { RendererComponentLoader } from "@/lib/content/renderer/loader";

export const domainComponentLoaders = [
  {
    name: chemistryComponentNames.ancientAtomLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/atom").then(
        ({ AncientAtomLab }) => AncientAtomLab
      ),
  },
  {
    name: chemistryComponentNames.atomShellLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/atom").then(
        ({ AtomShellLab }) => AtomShellLab
      ),
  },
  {
    name: chemistryComponentNames.atomSymbolLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/atom").then(
        ({ AtomSymbolLab }) => AtomSymbolLab
      ),
  },
  {
    name: chemistryComponentNames.chemicalReactionCharacteristicsLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/reaction").then(
        ({ ChemicalReactionCharacteristicsLab }) =>
          ChemicalReactionCharacteristicsLab
      ),
  },
  {
    name: chemistryComponentNames.chemicalReactionTypesLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/reaction").then(
        ({ ChemicalReactionTypesLab }) => ChemicalReactionTypesLab
      ),
  },
  {
    name: chemistryComponentNames.combiningVolumesLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/laws").then(
        ({ CombiningVolumesLab }) => CombiningVolumesLab
      ),
  },
  {
    name: chemistryComponentNames.constantCompositionLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/laws").then(
        ({ ConstantCompositionLab }) => ConstantCompositionLab
      ),
  },
  {
    name: chemistryComponentNames.daltonEvidenceLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/atom").then(
        ({ DaltonEvidenceLab }) => DaltonEvidenceLab
      ),
  },
  {
    name: chemistryComponentNames.electronConfigurationLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/electron").then(
        ({ ElectronConfigurationLab }) => ElectronConfigurationLab
      ),
  },
  {
    name: chemistryComponentNames.ionLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/particles").then(
        ({ IonLab }) => IonLab
      ),
  },
  {
    name: chemistryComponentNames.isotopeLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/particles").then(
        ({ IsotopeLab }) => IsotopeLab
      ),
  },
  {
    name: chemistryComponentNames.massConservationLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/laws").then(
        ({ MassConservationLab }) => MassConservationLab
      ),
  },
  {
    name: chemistryComponentNames.matterParticleReaderLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/particles").then(
        ({ MatterParticleReaderLab }) => MatterParticleReaderLab
      ),
  },
  {
    name: chemistryComponentNames.methaneCombustionEquationLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/reaction").then(
        ({ MethaneCombustionEquationLab }) => MethaneCombustionEquationLab
      ),
  },
  {
    name: chemistryComponentNames.modernPeriodicTableLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/periodic").then(
        ({ ModernPeriodicTableLab }) => ModernPeriodicTableLab
      ),
  },
  {
    name: chemistryComponentNames.multipleProportionsLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/laws").then(
        ({ MultipleProportionsLab }) => MultipleProportionsLab
      ),
  },
  {
    name: chemistryComponentNames.periodicPropertiesLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/periodic").then(
        ({ PeriodicPropertiesLab }) => PeriodicPropertiesLab
      ),
  },
  {
    name: chemistryComponentNames.subatomicParticlePropertiesLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/particles").then(
        ({ SubatomicParticlePropertiesLab }) => SubatomicParticlePropertiesLab
      ),
  },
  {
    name: chemistryComponentNames.subatomicParticlesLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/particles").then(
        ({ SubatomicParticlesLab }) => SubatomicParticlesLab
      ),
  },
  {
    name: chemistryComponentNames.valenceElectronLab,
    load: () =>
      import("@/lib/content/renderer/client/chemistry/electron").then(
        ({ ValenceElectronLab }) => ValenceElectronLab
      ),
  },
] satisfies readonly RendererComponentLoader[];
