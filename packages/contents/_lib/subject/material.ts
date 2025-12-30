import {
  AbsoluteIcon,
  AiProgrammingIcon,
  BankIcon,
  BulbIcon,
  CourtLawIcon,
  DnaIcon,
  ElectricWireIcon,
  GameIcon,
  GlobalIcon,
  GlobeIcon,
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
      return GlobalIcon;
    case "quantitative-knowledge":
      return AbsoluteIcon;
    case "mathematical-reasoning":
      return PuzzleIcon;
    default:
      return BulbIcon;
  }
}
