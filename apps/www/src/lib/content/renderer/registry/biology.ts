import { biologyComponentNames } from "@repo/design-system/lib/markdown/names";
import { BacteriaStructureLab } from "@/lib/content/renderer/client/biology/bacteria";
import {
  CellCutawayLab,
  CellScaleLab,
  DnaHelixLab,
} from "@/lib/content/renderer/client/biology/cells";
import {
  ChromosomePackingLab,
  GlycosidicBondLab,
  LipidLab,
  ProteinFoldLab,
  WaterBondLab,
} from "@/lib/content/renderer/client/biology/chemistry";
import {
  BloodTypingLab,
  CapillaryBedLab,
  HeartCycleLab,
} from "@/lib/content/renderer/client/biology/circulation";
import {
  GardenNameLab,
  KeyBuilderLab,
  KingdomSortLab,
  SeaNameLab,
  TaxonRankLab,
} from "@/lib/content/renderer/client/biology/classification";
import {
  CarbonBudgetLab,
  ClimateObservationLab,
  CoralBleachLab,
  GreenhouseEffectLab,
  SeaLevelRiseLab,
} from "@/lib/content/renderer/client/biology/climate";
import { PredatorPreyLab } from "@/lib/content/renderer/client/biology/ecology";
import {
  ActiveSiteLab,
  DenatureLab,
  EnzymeSaturationLab,
  EnzymeSecretionLab,
  LactaseColumnLab,
} from "@/lib/content/renderer/client/biology/enzymes";
import {
  ChloroplastStageLab,
  LeafLaminaCrossSectionLab,
  StomatalGuardCellLab,
} from "@/lib/content/renderer/client/biology/foliage";
import {
  FungiMyceliumLab,
  HyphaeDecayLab,
} from "@/lib/content/renderer/client/biology/fungi";
import {
  BloodGlucoseFeedbackLab,
  ThermoregulationSkinLab,
} from "@/lib/content/renderer/client/biology/homeostasis";
import {
  BodyPlanesLab,
  LabEquipmentLab,
  SpecimenDrawingLab,
  SpillResponseLab,
  WasteSortLab,
} from "@/lib/content/renderer/client/biology/laboratory";
import {
  ActiveTransportPumpLab,
  FluidMosaicMembraneLab,
  PlasmolysisCellLab,
} from "@/lib/content/renderer/client/biology/membrane";
import {
  BinaryFissionLab,
  ChemotaxisLab,
  GramStainLab,
  YogurtLab,
} from "@/lib/content/renderer/client/biology/microbes";
import {
  NeuronImpulseLab,
  ReflexArcLab,
  SynapseLab,
} from "@/lib/content/renderer/client/biology/nerve";
import {
  MicroscopeLab,
  NephronLab,
  RespirometerLab,
} from "@/lib/content/renderer/client/biology/physiology";
import {
  FertilisationLab,
  OsmosisLab,
  PhotosynthesisLab,
  PotometerLab,
  TropismLab,
} from "@/lib/content/renderer/client/biology/plants";
import {
  GametogenesisLab,
  ImplantationLab,
  MenstrualCycleLab,
  MetamorphosisLab,
  PlacentaLab,
  TwinsLab,
} from "@/lib/content/renderer/client/biology/reproduction";
import {
  MitochondrionLab,
  OxygenDebtLab,
  PaddyRootLab,
  YeastFermentationLab,
} from "@/lib/content/renderer/client/biology/respiration";
import {
  AnimalLocomotionLab,
  BoneHealthLab,
  JointMovementLab,
  MusclePairLab,
  VertebraLab,
} from "@/lib/content/renderer/client/biology/support";
import {
  PlantGrowthCurveLab,
  PlantTissueAnatomyLab,
  RootShootGrowthZoneLab,
} from "@/lib/content/renderer/client/biology/tissue";
import { SarsCov2VirionLab } from "@/lib/content/renderer/client/biology/virion";
import {
  AntibodyNeutralizeLab,
  EpidemicSpreadLab,
  VirusMorphologyLab,
  VirusReplicationLab,
  VirusRoleLab,
  VirusStructureLab,
} from "@/lib/content/renderer/client/biology/virus";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Every biology visual, which any lesson in any domain may use. */
export const biologyRenderers = [
  {
    name: biologyComponentNames.binaryFissionLab,
    component: BinaryFissionLab,
  },
  {
    name: biologyComponentNames.chemotaxisLab,
    component: ChemotaxisLab,
  },
  {
    name: biologyComponentNames.gramStainLab,
    component: GramStainLab,
  },
  {
    name: biologyComponentNames.yogurtLab,
    component: YogurtLab,
  },
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
  {
    name: biologyComponentNames.antibodyNeutralizeLab,
    component: AntibodyNeutralizeLab,
  },
  {
    name: biologyComponentNames.carbonBudgetLab,
    component: CarbonBudgetLab,
  },
  {
    name: biologyComponentNames.cellCutawayLab,
    component: CellCutawayLab,
  },
  {
    name: biologyComponentNames.cellScaleLab,
    component: CellScaleLab,
  },
  {
    name: biologyComponentNames.coralBleachLab,
    component: CoralBleachLab,
  },
  {
    name: biologyComponentNames.dnaHelixLab,
    component: DnaHelixLab,
  },
  {
    name: biologyComponentNames.epidemicSpreadLab,
    component: EpidemicSpreadLab,
  },
  {
    name: biologyComponentNames.hyphaeDecayLab,
    component: HyphaeDecayLab,
  },
  {
    name: biologyComponentNames.predatorPreyLab,
    component: PredatorPreyLab,
  },
  {
    name: biologyComponentNames.seaLevelRiseLab,
    component: SeaLevelRiseLab,
  },
  {
    name: biologyComponentNames.fertilisationLab,
    component: FertilisationLab,
  },
  {
    name: biologyComponentNames.microscopeLab,
    component: MicroscopeLab,
  },
  {
    name: biologyComponentNames.nephronLab,
    component: NephronLab,
  },
  {
    name: biologyComponentNames.osmosisLab,
    component: OsmosisLab,
  },
  {
    name: biologyComponentNames.photosynthesisLab,
    component: PhotosynthesisLab,
  },
  {
    name: biologyComponentNames.potometerLab,
    component: PotometerLab,
  },
  {
    name: biologyComponentNames.respirometerLab,
    component: RespirometerLab,
  },
  {
    name: biologyComponentNames.tropismLab,
    component: TropismLab,
  },
  {
    name: biologyComponentNames.bloodTypingLab,
    component: BloodTypingLab,
  },
  {
    name: biologyComponentNames.capillaryBedLab,
    component: CapillaryBedLab,
  },
  {
    name: biologyComponentNames.heartCycleLab,
    component: HeartCycleLab,
  },
  {
    name: biologyComponentNames.neuronImpulseLab,
    component: NeuronImpulseLab,
  },
  {
    name: biologyComponentNames.synapseLab,
    component: SynapseLab,
  },
  {
    name: biologyComponentNames.mitochondrionLab,
    component: MitochondrionLab,
  },
  {
    name: biologyComponentNames.oxygenDebtLab,
    component: OxygenDebtLab,
  },
  {
    name: biologyComponentNames.paddyRootLab,
    component: PaddyRootLab,
  },
  {
    name: biologyComponentNames.yeastFermentationLab,
    component: YeastFermentationLab,
  },
  {
    name: biologyComponentNames.activeSiteLab,
    component: ActiveSiteLab,
  },
  {
    name: biologyComponentNames.animalLocomotionLab,
    component: AnimalLocomotionLab,
  },
  {
    name: biologyComponentNames.bodyPlanesLab,
    component: BodyPlanesLab,
  },
  {
    name: biologyComponentNames.boneHealthLab,
    component: BoneHealthLab,
  },
  {
    name: biologyComponentNames.chromosomePackingLab,
    component: ChromosomePackingLab,
  },
  {
    name: biologyComponentNames.denatureLab,
    component: DenatureLab,
  },
  {
    name: biologyComponentNames.enzymeSaturationLab,
    component: EnzymeSaturationLab,
  },
  {
    name: biologyComponentNames.enzymeSecretionLab,
    component: EnzymeSecretionLab,
  },
  {
    name: biologyComponentNames.gametogenesisLab,
    component: GametogenesisLab,
  },
  {
    name: biologyComponentNames.gardenNameLab,
    component: GardenNameLab,
  },
  {
    name: biologyComponentNames.glycosidicBondLab,
    component: GlycosidicBondLab,
  },
  {
    name: biologyComponentNames.implantationLab,
    component: ImplantationLab,
  },
  {
    name: biologyComponentNames.jointMovementLab,
    component: JointMovementLab,
  },
  {
    name: biologyComponentNames.keyBuilderLab,
    component: KeyBuilderLab,
  },
  {
    name: biologyComponentNames.kingdomSortLab,
    component: KingdomSortLab,
  },
  {
    name: biologyComponentNames.labEquipmentLab,
    component: LabEquipmentLab,
  },
  {
    name: biologyComponentNames.lactaseColumnLab,
    component: LactaseColumnLab,
  },
  {
    name: biologyComponentNames.lipidLab,
    component: LipidLab,
  },
  {
    name: biologyComponentNames.menstrualCycleLab,
    component: MenstrualCycleLab,
  },
  {
    name: biologyComponentNames.metamorphosisLab,
    component: MetamorphosisLab,
  },
  {
    name: biologyComponentNames.musclePairLab,
    component: MusclePairLab,
  },
  {
    name: biologyComponentNames.placentaLab,
    component: PlacentaLab,
  },
  {
    name: biologyComponentNames.proteinFoldLab,
    component: ProteinFoldLab,
  },
  {
    name: biologyComponentNames.seaNameLab,
    component: SeaNameLab,
  },
  {
    name: biologyComponentNames.specimenDrawingLab,
    component: SpecimenDrawingLab,
  },
  {
    name: biologyComponentNames.spillResponseLab,
    component: SpillResponseLab,
  },
  {
    name: biologyComponentNames.taxonRankLab,
    component: TaxonRankLab,
  },
  {
    name: biologyComponentNames.twinsLab,
    component: TwinsLab,
  },
  {
    name: biologyComponentNames.vertebraLab,
    component: VertebraLab,
  },
  {
    name: biologyComponentNames.wasteSortLab,
    component: WasteSortLab,
  },
  {
    name: biologyComponentNames.waterBondLab,
    component: WaterBondLab,
  },
  {
    name: biologyComponentNames.chloroplastStageLab,
    component: ChloroplastStageLab,
  },
  {
    name: biologyComponentNames.leafLaminaCrossSectionLab,
    component: LeafLaminaCrossSectionLab,
  },
  {
    name: biologyComponentNames.plantGrowthCurveLab,
    component: PlantGrowthCurveLab,
  },
  {
    name: biologyComponentNames.plantTissueAnatomyLab,
    component: PlantTissueAnatomyLab,
  },
  {
    name: biologyComponentNames.rootShootGrowthZoneLab,
    component: RootShootGrowthZoneLab,
  },
  {
    name: biologyComponentNames.stomatalGuardCellLab,
    component: StomatalGuardCellLab,
  },
  {
    name: biologyComponentNames.activeTransportPumpLab,
    component: ActiveTransportPumpLab,
  },
  {
    name: biologyComponentNames.bloodGlucoseFeedbackLab,
    component: BloodGlucoseFeedbackLab,
  },
  {
    name: biologyComponentNames.plasmolysisCellLab,
    component: PlasmolysisCellLab,
  },
  {
    name: biologyComponentNames.reflexArcLab,
    component: ReflexArcLab,
  },
  {
    name: biologyComponentNames.thermoregulationSkinLab,
    component: ThermoregulationSkinLab,
  },
  {
    name: biologyComponentNames.fluidMosaicMembraneLab,
    component: FluidMosaicMembraneLab,
  },
] satisfies readonly RendererImplementation[];
