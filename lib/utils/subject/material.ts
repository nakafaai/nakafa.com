import type { SubjectCategory } from "@/types/subject/category";
import type { Grade } from "@/types/subject/grade";
import type { Material, MaterialList } from "@/types/subject/material";
import { MaterialListSchema } from "@/types/subject/material";
import {
  BrainCircuitIcon,
  CableIcon,
  ChartPieIcon,
  CodeIcon,
  CodeXmlIcon,
  ComputerIcon,
  DraftingCompassIcon,
  EarthIcon,
  FlaskConicalIcon,
  Gamepad2Icon,
  HourglassIcon,
  LightbulbIcon,
  MapPinIcon,
  PawPrintIcon,
  PiIcon,
  ScaleIcon,
  SpeechIcon,
} from "lucide-react";
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
      `@/contents/${cleanPath}/_data/${locale}-material.ts`
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
export function getMaterialIcon(material: Material) {
  switch (material) {
    case "mathematics":
      return PiIcon;
    case "physics":
      return DraftingCompassIcon;
    case "chemistry":
      return FlaskConicalIcon;
    case "biology":
      return PawPrintIcon;
    case "geography":
      return EarthIcon;
    case "economy":
      return ChartPieIcon;
    case "history":
      return HourglassIcon;
    case "sociology":
      return SpeechIcon;
    case "informatics":
      return CodeIcon;
    case "geospatial":
      return MapPinIcon;
    case "ai-ds":
      return BrainCircuitIcon;
    case "game-engineering":
      return Gamepad2Icon;
    case "political-science":
      return ScaleIcon;
    case "computer-science":
      return CodeXmlIcon;
    case "technology-electro-medical":
      return CableIcon;
    case "informatics-engineering":
      return ComputerIcon;
    default:
      return LightbulbIcon;
  }
}
