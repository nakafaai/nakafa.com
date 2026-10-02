import {
  AiProgrammingIcon,
  BankIcon,
  BulbIcon,
  CourtLawIcon,
  DnaIcon,
  ElectricWireIcon,
  GameIcon,
  Globe02Icon,
  GlobeIcon,
  LaptopIcon,
  MapPinIcon,
  NeuralNetworkIcon,
  PhysicsIcon,
  PiIcon,
  ScrollIcon,
  SourceCodeIcon,
  TestTubeIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";

const materialIconByKey = {
  "ai-ds": NeuralNetworkIcon,
  biology: DnaIcon,
  chemistry: TestTubeIcon,
  "computer-science": AiProgrammingIcon,
  economy: BankIcon,
  "game-engineering": GameIcon,
  geography: GlobeIcon,
  geospatial: MapPinIcon,
  history: ScrollIcon,
  informatics: SourceCodeIcon,
  "informatics-engineering": LaptopIcon,
  "international-relations": Globe02Icon,
  mathematics: PiIcon,
  physics: PhysicsIcon,
  "political-science": CourtLawIcon,
  sociology: UserGroupIcon,
  "technology-electro-medical": ElectricWireIcon,
};

type MaterialIconKey = keyof typeof materialIconByKey;

function isMaterialIconKey(value: string): value is MaterialIconKey {
  return Object.hasOwn(materialIconByKey, value);
}

/**
 * Resolves the icon used for a subject material slug.
 *
 * @param material - Material slug to map to an icon
 * @returns Hugeicons icon for the material
 */
export function getMaterialIcon(material: string) {
  if (!isMaterialIconKey(material)) {
    return BulbIcon;
  }

  return materialIconByKey[material];
}
