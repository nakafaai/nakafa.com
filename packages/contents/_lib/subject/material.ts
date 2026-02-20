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
import type { ExercisesMaterial } from "@repo/contents/_types/exercises/material";
import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type {
  Material,
  MaterialList,
} from "@repo/contents/_types/subject/material";
import { MaterialListSchema } from "@repo/contents/_types/subject/material";
import { cleanSlug } from "@repo/utilities/helper";
import type { Locale } from "next-intl";

/**
 * Gets the path to a material.
 * @param category - The category to get the material for.
 * @param grade - The grade to get the material for.
 * @param material - The material to get the path for.
 * @returns The path to the material.
 */
export function getMaterialPath(
  category: SubjectCategory,
  grade: Grade,
  material: Material
) {
  return `/subject/${category}/${grade}/${material}` as const;
}

/**
 * Gets the materials for a subject.
 * @param path - The path to the subject.
 * @param locale - The locale to get the materials for.
 * @returns The materials for the subject.
 */
export async function getMaterials(
  path: string,
  locale: Locale
): Promise<MaterialList> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = path.startsWith("/") ? path.substring(1) : path;

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
 * Gets the icon for a material.
 * @param material - The material to get the icon for.
 * @returns The icon for the material.
 */
export function getMaterialIcon(material: Material | ExercisesMaterial) {
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
 * Gets the current chapter and item from the materials list by path.
 * Evidence: Reuses pattern from exercises/material.ts
 * @param path - The path to search for (can be chapter href or item href)
 * @param materials - The materials list
 * @returns The current chapter and item if found
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
