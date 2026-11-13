import { chemistryComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  AncientAtomLab,
  AtomShellLab,
  AtomSymbolLab,
  DaltonEvidenceLab,
} from "@/lib/content/renderer/client/chemistry/atom";
import {
  ElectronConfigurationLab,
  ValenceElectronLab,
} from "@/lib/content/renderer/client/chemistry/electron";
import {
  CombiningVolumesLab,
  ConstantCompositionLab,
  MassConservationLab,
  MultipleProportionsLab,
} from "@/lib/content/renderer/client/chemistry/laws";
import {
  BohrEmissionLab,
  CathodeRayLab,
  OrbitalCloudLab,
  RutherfordScatteringLab,
} from "@/lib/content/renderer/client/chemistry/model";
import {
  MoleculeShapeLab,
  ReactionBalanceLab,
} from "@/lib/content/renderer/client/chemistry/molecule";
import {
  IonLab,
  IsotopeLab,
  MatterParticleReaderLab,
  SubatomicParticlePropertiesLab,
  SubatomicParticlesLab,
} from "@/lib/content/renderer/client/chemistry/particles";
import {
  ModernPeriodicTableLab,
  PeriodicPropertiesLab,
} from "@/lib/content/renderer/client/chemistry/periodic";
import {
  ChemicalReactionCharacteristicsLab,
  ChemicalReactionTypesLab,
  MethaneCombustionEquationLab,
} from "@/lib/content/renderer/client/chemistry/reaction";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every chemistry visual, which any lesson in any domain may use. */
export const chemistryRenderers = [
  {
    name: chemistryComponentNames.ancientAtomLab,
    component: AncientAtomLab,
  },
  {
    name: chemistryComponentNames.atomShellLab,
    component: AtomShellLab,
  },
  {
    name: chemistryComponentNames.atomSymbolLab,
    component: AtomSymbolLab,
  },
  {
    name: chemistryComponentNames.bohrEmissionLab,
    component: BohrEmissionLab,
  },
  {
    name: chemistryComponentNames.cathodeRayLab,
    component: CathodeRayLab,
  },
  {
    name: chemistryComponentNames.chemicalReactionCharacteristicsLab,
    component: ChemicalReactionCharacteristicsLab,
  },
  {
    name: chemistryComponentNames.chemicalReactionTypesLab,
    component: ChemicalReactionTypesLab,
  },
  {
    name: chemistryComponentNames.combiningVolumesLab,
    component: CombiningVolumesLab,
  },
  {
    name: chemistryComponentNames.constantCompositionLab,
    component: ConstantCompositionLab,
  },
  {
    name: chemistryComponentNames.daltonEvidenceLab,
    component: DaltonEvidenceLab,
  },
  {
    name: chemistryComponentNames.electronConfigurationLab,
    component: ElectronConfigurationLab,
  },
  {
    name: chemistryComponentNames.ionLab,
    component: IonLab,
  },
  {
    name: chemistryComponentNames.isotopeLab,
    component: IsotopeLab,
  },
  {
    name: chemistryComponentNames.massConservationLab,
    component: MassConservationLab,
  },
  {
    name: chemistryComponentNames.matterParticleReaderLab,
    component: MatterParticleReaderLab,
  },
  {
    name: chemistryComponentNames.methaneCombustionEquationLab,
    component: MethaneCombustionEquationLab,
  },
  {
    name: chemistryComponentNames.modernPeriodicTableLab,
    component: ModernPeriodicTableLab,
  },
  {
    name: chemistryComponentNames.moleculeShapeLab,
    component: MoleculeShapeLab,
  },
  {
    name: chemistryComponentNames.multipleProportionsLab,
    component: MultipleProportionsLab,
  },
  {
    name: chemistryComponentNames.orbitalCloudLab,
    component: OrbitalCloudLab,
  },
  {
    name: chemistryComponentNames.periodicPropertiesLab,
    component: PeriodicPropertiesLab,
  },
  {
    name: chemistryComponentNames.reactionBalanceLab,
    component: ReactionBalanceLab,
  },
  {
    name: chemistryComponentNames.rutherfordScatteringLab,
    component: RutherfordScatteringLab,
  },
  {
    name: chemistryComponentNames.subatomicParticlePropertiesLab,
    component: SubatomicParticlePropertiesLab,
  },
  {
    name: chemistryComponentNames.subatomicParticlesLab,
    component: SubatomicParticlesLab,
  },
  {
    name: chemistryComponentNames.valenceElectronLab,
    component: ValenceElectronLab,
  },
] satisfies readonly RendererImplementation[];
