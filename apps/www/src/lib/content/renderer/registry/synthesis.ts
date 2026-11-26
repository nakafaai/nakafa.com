import { chemistryComponentNames } from "@repo/design-system/lib/markdown/names";
import {
  AtomEconomyReactorLab,
  GreenCatalystCycleLab,
} from "@/lib/content/renderer/client/chemistry/green";
import {
  HalogenDisplacementLab,
  PeriodThreeOxideLab,
} from "@/lib/content/renderer/client/chemistry/groups";
import {
  HaberAmmoniaConverterLab,
  SaponificationKettleLab,
  SoapMicelleEmulsionLab,
} from "@/lib/content/renderer/client/chemistry/industry";
import {
  AlloySlipPlaneLab,
  ContactSulfuricTowerLab,
  GlassCeramicLatticeLab,
} from "@/lib/content/renderer/client/chemistry/materials";
import {
  AlkaneAlkeneIsomerLab,
  EsterificationRefluxLab,
  FractionalDistillationLab,
} from "@/lib/content/renderer/client/chemistry/organic";
import {
  AdditionPolymerChainLab,
  CondensationNylonLab,
  RubberVulcanizationLab,
} from "@/lib/content/renderer/client/chemistry/polymer";
import {
  PhIndicatorScaleLab,
  SaltBridgeIonFlowLab,
} from "@/lib/content/renderer/client/chemistry/solution";
import {
  AvogadroGasVolumeLab,
  CalorimeterEnthalpyLab,
} from "@/lib/content/renderer/client/chemistry/stoichiometry";
import type { RendererImplementation } from "@/lib/content/renderer/selection";

/** Applied, organic, green, industrial, materials, and polymer chemistry labs. */
export const synthesisRenderers = [
  {
    name: chemistryComponentNames.additionPolymerChainLab,
    component: AdditionPolymerChainLab,
  },
  {
    name: chemistryComponentNames.alkaneAlkeneIsomerLab,
    component: AlkaneAlkeneIsomerLab,
  },
  {
    name: chemistryComponentNames.alloySlipPlaneLab,
    component: AlloySlipPlaneLab,
  },
  {
    name: chemistryComponentNames.atomEconomyReactorLab,
    component: AtomEconomyReactorLab,
  },
  {
    name: chemistryComponentNames.avogadroGasVolumeLab,
    component: AvogadroGasVolumeLab,
  },
  {
    name: chemistryComponentNames.calorimeterEnthalpyLab,
    component: CalorimeterEnthalpyLab,
  },
  {
    name: chemistryComponentNames.condensationNylonLab,
    component: CondensationNylonLab,
  },
  {
    name: chemistryComponentNames.contactSulfuricTowerLab,
    component: ContactSulfuricTowerLab,
  },
  {
    name: chemistryComponentNames.esterificationRefluxLab,
    component: EsterificationRefluxLab,
  },
  {
    name: chemistryComponentNames.fractionalDistillationLab,
    component: FractionalDistillationLab,
  },
  {
    name: chemistryComponentNames.glassCeramicLatticeLab,
    component: GlassCeramicLatticeLab,
  },
  {
    name: chemistryComponentNames.greenCatalystCycleLab,
    component: GreenCatalystCycleLab,
  },
  {
    name: chemistryComponentNames.haberAmmoniaConverterLab,
    component: HaberAmmoniaConverterLab,
  },
  {
    name: chemistryComponentNames.halogenDisplacementLab,
    component: HalogenDisplacementLab,
  },
  {
    name: chemistryComponentNames.periodThreeOxideLab,
    component: PeriodThreeOxideLab,
  },
  {
    name: chemistryComponentNames.phIndicatorScaleLab,
    component: PhIndicatorScaleLab,
  },
  {
    name: chemistryComponentNames.rubberVulcanizationLab,
    component: RubberVulcanizationLab,
  },
  {
    name: chemistryComponentNames.saltBridgeIonFlowLab,
    component: SaltBridgeIonFlowLab,
  },
  {
    name: chemistryComponentNames.saponificationKettleLab,
    component: SaponificationKettleLab,
  },
  {
    name: chemistryComponentNames.soapMicelleEmulsionLab,
    component: SoapMicelleEmulsionLab,
  },
] satisfies readonly RendererImplementation[];
