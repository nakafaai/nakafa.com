import {
  AbsoluteIcon,
  AiProgrammingIcon,
  BankIcon,
  BookEditIcon,
  Brain02Icon,
  BulbIcon,
  ChatQuestionIcon,
  CourtLawIcon,
  DnaIcon,
  ElectricWireIcon,
  File01Icon,
  GameIcon,
  Globe02Icon,
  GlobeIcon,
  LanguageSkillIcon,
  LaptopIcon,
  MapPinIcon,
  NeuralNetworkIcon,
  PhysicsIcon,
  PiIcon,
  PuzzleIcon,
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
  "english-language": LanguageSkillIcon,
  "game-engineering": GameIcon,
  "general-knowledge": BookEditIcon,
  "general-reasoning": Brain02Icon,
  geography: GlobeIcon,
  geospatial: MapPinIcon,
  history: ScrollIcon,
  "indonesian-language": ChatQuestionIcon,
  informatics: SourceCodeIcon,
  "informatics-engineering": LaptopIcon,
  "international-relations": Globe02Icon,
  "mathematical-reasoning": PuzzleIcon,
  mathematics: PiIcon,
  physics: PhysicsIcon,
  "political-science": CourtLawIcon,
  "quantitative-knowledge": AbsoluteIcon,
  "reading-and-writing-skills": File01Icon,
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
