import { AncientAtomLab } from "@repo/design-system/components/contents/chemistry/ancient-atom/lab";
import { AtomShellLab } from "@repo/design-system/components/contents/chemistry/atom-shell/lab";
import { AtomSymbolLab } from "@repo/design-system/components/contents/chemistry/atom-symbol/lab";
import { ChemicalReactionCharacteristicsLab } from "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/lab";
import { ChemicalReactionTypesLab } from "@repo/design-system/components/contents/chemistry/chemical-reaction-types/lab";
import { CombiningVolumesLab } from "@repo/design-system/components/contents/chemistry/combining-volumes-law/lab";
import { ConstantCompositionLab } from "@repo/design-system/components/contents/chemistry/constant-composition-law/lab";
import { DaltonEvidenceLab } from "@repo/design-system/components/contents/chemistry/dalton-evidence/lab";
import { ElectronConfigurationLab } from "@repo/design-system/components/contents/chemistry/electron-configuration/lab";
import { IonLab } from "@repo/design-system/components/contents/chemistry/ion/lab";
import { IsotopeLab } from "@repo/design-system/components/contents/chemistry/isotope/lab";
import { MassConservationLab } from "@repo/design-system/components/contents/chemistry/mass-conservation-law/lab";
import { MatterParticleReaderLab } from "@repo/design-system/components/contents/chemistry/matter-particle-reader/lab";
import { MethaneCombustionEquationLab } from "@repo/design-system/components/contents/chemistry/methane-combustion-equation/lab";
import { ModernPeriodicTableLab } from "@repo/design-system/components/contents/chemistry/modern-periodic-table/lab";
import { MultipleProportionsLab } from "@repo/design-system/components/contents/chemistry/multiple-proportions-law/lab";
import { PeriodicPropertiesLab } from "@repo/design-system/components/contents/chemistry/periodic-properties/lab";
import { SubatomicParticlesLab } from "@repo/design-system/components/contents/chemistry/subatomic-particles/lab";
import { SubatomicParticlePropertiesLab } from "@repo/design-system/components/contents/chemistry/subatomic-particles-properties/lab";
import { ValenceElectronLab } from "@repo/design-system/components/contents/chemistry/valence-electron/lab";
import { chemistryComponentNames } from "@repo/design-system/lib/markdown/names";
import { mdxComponents } from "@repo/design-system/lib/markdown/registry";
import type { MDXComponents } from "@repo/design-system/types/markdown";

/** Rich component implementations owned by chemistry routes. */
export const chemistryRegistry = {
  [chemistryComponentNames.ancientAtomLab]: AncientAtomLab,
  [chemistryComponentNames.atomShellLab]: AtomShellLab,
  [chemistryComponentNames.atomSymbolLab]: AtomSymbolLab,
  [chemistryComponentNames.chemicalReactionCharacteristicsLab]:
    ChemicalReactionCharacteristicsLab,
  [chemistryComponentNames.chemicalReactionTypesLab]: ChemicalReactionTypesLab,
  [chemistryComponentNames.combiningVolumesLab]: CombiningVolumesLab,
  [chemistryComponentNames.constantCompositionLab]: ConstantCompositionLab,
  [chemistryComponentNames.daltonEvidenceLab]: DaltonEvidenceLab,
  [chemistryComponentNames.electronConfigurationLab]: ElectronConfigurationLab,
  [chemistryComponentNames.ionLab]: IonLab,
  [chemistryComponentNames.isotopeLab]: IsotopeLab,
  [chemistryComponentNames.massConservationLab]: MassConservationLab,
  [chemistryComponentNames.matterParticleReaderLab]: MatterParticleReaderLab,
  [chemistryComponentNames.methaneCombustionEquationLab]:
    MethaneCombustionEquationLab,
  [chemistryComponentNames.modernPeriodicTableLab]: ModernPeriodicTableLab,
  [chemistryComponentNames.multipleProportionsLab]: MultipleProportionsLab,
  [chemistryComponentNames.periodicPropertiesLab]: PeriodicPropertiesLab,
  [chemistryComponentNames.subatomicParticlePropertiesLab]:
    SubatomicParticlePropertiesLab,
  [chemistryComponentNames.subatomicParticlesLab]: SubatomicParticlesLab,
  [chemistryComponentNames.valenceElectronLab]: ValenceElectronLab,
} satisfies MDXComponents;

/** Complete renderer used only by chemistry routes. */
export const chemistryComponents: MDXComponents = {
  ...mdxComponents,
  ...chemistryRegistry,
};
