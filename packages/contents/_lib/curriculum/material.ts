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
import type { MaterialList } from "@repo/contents/_types/curriculum/material";
import { getLessonMaterialList } from "@repo/contents/_types/material/registry";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";

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
 * Loads the localized material list for a curriculum lesson.
 *
 * @param path - Material lesson path, with or without a leading slash
 * @param locale - Locale used to select localized material labels
 * @returns Parsed material list, or an empty list when unavailable
 */
export const getMaterials = Effect.fn("Contents.Subject.getMaterials")(
  (path: string, locale: Locale) =>
    Effect.sync(() => {
      const cleanPath = path.startsWith("/") ? path.slice(1) : path;
      const normalizedPath = cleanSlug(cleanPath);

      return getLessonMaterialList(normalizedPath, locale);
    })
);

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

/**
 * Finds the active chapter and optional item for a route path.
 *
 * @param path - Current route path to match against chapter and item href values
 * @param materials - Localized material lesson list
 * @returns Matching chapter and item when either is found
 */
export function getCurrentMaterial(path: string, materials: MaterialList) {
  const normalizedPath = cleanSlug(path);

  for (const chapter of materials) {
    if (cleanSlug(chapter.href) === normalizedPath) {
      return {
        currentChapter: Option.some(chapter),
        currentItem: Option.none<(typeof materials)[number]["items"][number]>(),
      };
    }

    for (const item of chapter.items) {
      if (cleanSlug(item.href) === normalizedPath) {
        return {
          currentChapter: Option.some(chapter),
          currentItem: Option.some(item),
        };
      }
    }
  }

  return {
    currentChapter: Option.none<(typeof materials)[number]>(),
    currentItem: Option.none<(typeof materials)[number]["items"][number]>(),
  };
}
