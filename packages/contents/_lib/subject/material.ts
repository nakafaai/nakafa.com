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
import { getSubjectMaterialList } from "@repo/contents/_types/material/registry";
import type { MaterialList } from "@repo/contents/_types/subject/material";
import { cleanSlug } from "@repo/utilities/helper";
import { Effect, Option } from "effect";
import type { Locale } from "next-intl";

/**
 * Loads the localized material list for a subject section.
 *
 * @param path - Subject material path, with or without a leading slash
 * @param locale - Locale used to select localized material labels
 * @returns Parsed material list, or an empty list when unavailable
 */
export const getMaterials = Effect.fn("Contents.Subject.getMaterials")(
  (path: string, locale: Locale) =>
    Effect.sync(() => {
      const cleanPath = path.startsWith("/") ? path.slice(1) : path;
      const normalizedPath = cleanSlug(cleanPath);

      return getSubjectMaterialList(normalizedPath, locale);
    })
);

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
