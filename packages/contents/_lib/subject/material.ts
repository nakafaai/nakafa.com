import type { SubjectCategory } from "@repo/contents/_types/subject/category";
import type { Grade } from "@repo/contents/_types/subject/grade";
import type {
  Material,
  MaterialList,
} from "@repo/contents/_types/subject/material";
import { MaterialListSchema } from "@repo/contents/_types/subject/material";
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
  HandshakeIcon,
  HourglassIcon,
  LightbulbIcon,
  MapPinIcon,
  PawPrintIcon,
  PiIcon,
  ScaleIcon,
  SpeechIcon,
} from "lucide-react";
import type { Locale } from "next-intl";
import { createElement } from "react";

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
export function getMaterialIcon(material: Material) {
  switch (material) {
    case "mathematics":
      return createElement(PiIcon);
    case "physics":
      return createElement(DraftingCompassIcon);
    case "chemistry":
      return createElement(FlaskConicalIcon);
    case "biology":
      return createElement(PawPrintIcon);
    case "geography":
      return createElement(EarthIcon);
    case "economy":
      return createElement(ChartPieIcon);
    case "history":
      return createElement(HourglassIcon);
    case "sociology":
      return createElement(SpeechIcon);
    case "informatics":
      return createElement(CodeIcon);
    case "geospatial":
      return createElement(MapPinIcon);
    case "ai-ds":
      return createElement(BrainCircuitIcon);
    case "game-engineering":
      return createElement(Gamepad2Icon);
    case "political-science":
      return createElement(ScaleIcon);
    case "computer-science":
      return createElement(CodeXmlIcon);
    case "technology-electro-medical":
      return createElement(CableIcon);
    case "informatics-engineering":
      return createElement(ComputerIcon);
    case "international-relations":
      return createElement(HandshakeIcon);
    default:
      return createElement(LightbulbIcon);
  }
}
