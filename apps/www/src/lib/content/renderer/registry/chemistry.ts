import { chemistryComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  AncientAtomLab,
  AtomShellLab,
  AtomSymbolLab,
  DaltonEvidenceLab,
} from "@/lib/content/renderer/client/chemistry/atom";
import {
  FizzBalanceLab,
  LavoisierCalxLab,
  PrecipitateLab,
  SteelWoolLab,
} from "@/lib/content/renderer/client/chemistry/balance";
import {
  ChemicalCellLab,
  ElectrolysisLab,
} from "@/lib/content/renderer/client/chemistry/electrochemistry";
import {
  ElectronConfigurationLab,
  ValenceElectronLab,
} from "@/lib/content/renderer/client/chemistry/electron";
import {
  DynamicEquilibriumLab,
  EquilibriumQuotientLab,
  LeChatelierLab,
} from "@/lib/content/renderer/client/chemistry/equilibrium";
import {
  CatalystPathwayLab,
  CollisionTheoryEnergyLab,
} from "@/lib/content/renderer/client/chemistry/kinetics";
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
  GasRateLab,
  TitrationLab,
} from "@/lib/content/renderer/client/chemistry/quantitative";
import {
  ChemicalReactionCharacteristicsLab,
  ChemicalReactionTypesLab,
  MethaneCombustionEquationLab,
} from "@/lib/content/renderer/client/chemistry/reaction";
import {
  AlkaliWaterLab,
  IonFormationLab,
  IonLatticeLab,
  MassSpectrometerLab,
  MillikanOilDropLab,
  ParticleTrackLab,
  RadioactiveDecayLab,
} from "@/lib/content/renderer/client/chemistry/structure";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every chemistry visual, which any lesson in any domain may use. */
export const chemistryRenderers = [
  {
    name: chemistryComponentNames.gasRateLab,
    component: GasRateLab,
  },
  {
    name: chemistryComponentNames.fizzBalanceLab,
    component: FizzBalanceLab,
  },
  {
    name: chemistryComponentNames.lavoisierCalxLab,
    component: LavoisierCalxLab,
  },
  {
    name: chemistryComponentNames.precipitateLab,
    component: PrecipitateLab,
  },
  {
    name: chemistryComponentNames.steelWoolLab,
    component: SteelWoolLab,
  },
  {
    name: chemistryComponentNames.alkaliWaterLab,
    component: AlkaliWaterLab,
  },
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
    name: chemistryComponentNames.chemicalCellLab,
    component: ChemicalCellLab,
  },
  {
    name: chemistryComponentNames.electrolysisLab,
    component: ElectrolysisLab,
  },
  {
    name: chemistryComponentNames.electronConfigurationLab,
    component: ElectronConfigurationLab,
  },
  {
    name: chemistryComponentNames.ionFormationLab,
    component: IonFormationLab,
  },
  {
    name: chemistryComponentNames.ionLab,
    component: IonLab,
  },
  {
    name: chemistryComponentNames.ionLatticeLab,
    component: IonLatticeLab,
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
    name: chemistryComponentNames.massSpectrometerLab,
    component: MassSpectrometerLab,
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
    name: chemistryComponentNames.millikanOilDropLab,
    component: MillikanOilDropLab,
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
    name: chemistryComponentNames.particleTrackLab,
    component: ParticleTrackLab,
  },
  {
    name: chemistryComponentNames.periodicPropertiesLab,
    component: PeriodicPropertiesLab,
  },
  {
    name: chemistryComponentNames.radioactiveDecayLab,
    component: RadioactiveDecayLab,
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
    name: chemistryComponentNames.titrationLab,
    component: TitrationLab,
  },
  {
    name: chemistryComponentNames.valenceElectronLab,
    component: ValenceElectronLab,
  },
  {
    name: chemistryComponentNames.dynamicEquilibriumLab,
    component: DynamicEquilibriumLab,
  },
  {
    name: chemistryComponentNames.equilibriumQuotientLab,
    component: EquilibriumQuotientLab,
  },
  {
    name: chemistryComponentNames.leChatelierLab,
    component: LeChatelierLab,
  },
  {
    name: chemistryComponentNames.catalystPathwayLab,
    component: CatalystPathwayLab,
  },
  {
    name: chemistryComponentNames.collisionTheoryEnergyLab,
    component: CollisionTheoryEnergyLab,
  },
] satisfies readonly RendererImplementation[];
