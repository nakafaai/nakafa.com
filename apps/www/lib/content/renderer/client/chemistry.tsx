"use client";

import dynamic from "next/dynamic";

export const LazyAncientAtomLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/ancient-atom/lab"
  ).then(({ AncientAtomLab }) => AncientAtomLab)
);
export const LazyAtomShellLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/atom-shell/lab"
  ).then(({ AtomShellLab }) => AtomShellLab)
);
export const LazyAtomSymbolLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/atom-symbol/lab"
  ).then(({ AtomSymbolLab }) => AtomSymbolLab)
);
export const LazyChemicalReactionCharacteristicsLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/chemical-reaction-characteristics/lab"
  ).then(
    ({ ChemicalReactionCharacteristicsLab }) =>
      ChemicalReactionCharacteristicsLab
  )
);
export const LazyChemicalReactionTypesLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/chemical-reaction-types/lab"
  ).then(({ ChemicalReactionTypesLab }) => ChemicalReactionTypesLab)
);
export const LazyCombiningVolumesLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/combining-volumes-law/lab"
  ).then(({ CombiningVolumesLab }) => CombiningVolumesLab)
);
export const LazyConstantCompositionLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/constant-composition-law/lab"
  ).then(({ ConstantCompositionLab }) => ConstantCompositionLab)
);
export const LazyDaltonEvidenceLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/dalton-evidence/lab"
  ).then(({ DaltonEvidenceLab }) => DaltonEvidenceLab)
);
export const LazyElectronConfigurationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/electron-configuration/lab"
  ).then(({ ElectronConfigurationLab }) => ElectronConfigurationLab)
);
export const LazyIonLab = dynamic(() =>
  import("@repo/design-system/components/contents/chemistry/ion/lab").then(
    ({ IonLab }) => IonLab
  )
);
export const LazyIsotopeLab = dynamic(() =>
  import("@repo/design-system/components/contents/chemistry/isotope/lab").then(
    ({ IsotopeLab }) => IsotopeLab
  )
);
export const LazyMassConservationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/mass-conservation-law/lab"
  ).then(({ MassConservationLab }) => MassConservationLab)
);
export const LazyMatterParticleReaderLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/matter-particle-reader/lab"
  ).then(({ MatterParticleReaderLab }) => MatterParticleReaderLab)
);
export const LazyMethaneCombustionEquationLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/methane-combustion-equation/lab"
  ).then(({ MethaneCombustionEquationLab }) => MethaneCombustionEquationLab)
);
export const LazyModernPeriodicTableLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/modern-periodic-table/lab"
  ).then(({ ModernPeriodicTableLab }) => ModernPeriodicTableLab)
);
export const LazyMultipleProportionsLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/multiple-proportions-law/lab"
  ).then(({ MultipleProportionsLab }) => MultipleProportionsLab)
);
export const LazyPeriodicPropertiesLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/periodic-properties/lab"
  ).then(({ PeriodicPropertiesLab }) => PeriodicPropertiesLab)
);
export const LazySubatomicParticlePropertiesLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/subatomic-particles-properties/lab"
  ).then(({ SubatomicParticlePropertiesLab }) => SubatomicParticlePropertiesLab)
);
export const LazySubatomicParticlesLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/subatomic-particles/lab"
  ).then(({ SubatomicParticlesLab }) => SubatomicParticlesLab)
);
export const LazyValenceElectronLab = dynamic(() =>
  import(
    "@repo/design-system/components/contents/chemistry/valence-electron/lab"
  ).then(({ ValenceElectronLab }) => ValenceElectronLab)
);
