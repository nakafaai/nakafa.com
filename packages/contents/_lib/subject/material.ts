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
import type { MaterialList } from "@repo/contents/_types/subject/material";
import { MaterialListSchema } from "@repo/contents/_types/subject/material";
import { cleanSlug } from "@repo/utilities/helper";
import type { Locale } from "next-intl";

/**
 * Loads the localized material list for a subject section.
 *
 * @param path - Subject material path, with or without a leading slash
 * @param locale - Locale used to select the `_data/*-material.ts` file
 * @returns Parsed material list, or an empty list when unavailable
 */
export async function getMaterials(
  path: string,
  locale: Locale
): Promise<MaterialList> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;

    const content = await import(
      `@repo/contents/${cleanPath}/_data/${locale}-material.ts`
    );

    const parsedContent = MaterialListSchema.parse(content.default);

    return parsedContent;
  } catch {
    return [];
  }
}

/**
 * Resolves the icon used for a subject or exercises material slug.
 *
 * @param material - Material slug to map to an icon
 * @returns Hugeicons icon for the material
 */
export function getMaterialIcon(material: string) {
  switch (material) {
    case "mathematics":
      return PiIcon;
    case "physics":
      return PhysicsIcon;
    case "chemistry":
      return TestTubeIcon;
    case "biology":
      return DnaIcon;
    case "geography":
      return GlobeIcon;
    case "economy":
      return BankIcon;
    case "history":
      return ScrollIcon;
    case "sociology":
      return UserGroupIcon;
    case "informatics":
      return SourceCodeIcon;
    case "geospatial":
      return MapPinIcon;
    case "ai-ds":
      return NeuralNetworkIcon;
    case "game-engineering":
      return GameIcon;
    case "political-science":
      return CourtLawIcon;
    case "computer-science":
      return AiProgrammingIcon;
    case "technology-electro-medical":
      return ElectricWireIcon;
    case "informatics-engineering":
      return LaptopIcon;
    case "international-relations":
      return Globe02Icon;
    case "quantitative-knowledge":
      return AbsoluteIcon;
    case "mathematical-reasoning":
      return PuzzleIcon;
    case "general-reasoning":
      return Brain02Icon;
    case "indonesian-language":
      return ChatQuestionIcon;
    case "english-language":
      return LanguageSkillIcon;
    case "general-knowledge":
      return BookEditIcon;
    case "reading-and-writing-skills":
      return File01Icon;
    default:
      return BulbIcon;
  }
}

/**
 * Finds the active chapter and optional item for a route path.
 *
 * @param path - Current route path to match against chapter and item href values
 * @param materials - Localized subject material list
 * @returns Matching chapter and item when either is found
 */
export function getCurrentMaterial(path: string, materials: MaterialList) {
  let currentChapter: (typeof materials)[number] | undefined;
  let currentItem: (typeof materials)[number]["items"][number] | undefined;

  for (const chapter of materials) {
    // Check if path matches chapter href
    if (cleanSlug(chapter.href) === cleanSlug(path)) {
      currentChapter = chapter;
      break;
    }

    // Check items within the chapter
    const foundItem = chapter.items.find(
      (item) => cleanSlug(item.href) === cleanSlug(path)
    );
    if (foundItem) {
      currentChapter = chapter;
      currentItem = foundItem;
      break;
    }
  }

  return { currentChapter, currentItem };
}
