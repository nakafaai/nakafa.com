import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type {
  ExercisesMaterial,
  ExercisesMaterialList,
} from "@repo/contents/_types/exercises/material";
import { ExercisesMaterialListSchema } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
import { cleanSlug } from "@repo/utilities/helper";
import type { Locale } from "next-intl";

/**
 * Gets the path to an exercises material.
 * @param category - The category to get the material for.
 * @param type - The type to get the material for.
 * @param material - The material to get the path for.
 * @returns The path to the material.
 */
export function getMaterialPath(
  category: ExercisesCategory,
  type: ExercisesType,
  material: ExercisesMaterial
) {
  return `/exercises/${category}/${type}/${material}` as const;
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
): Promise<ExercisesMaterialList> {
  try {
    // Strip leading slash if present for consistency
    const cleanPath = path.startsWith("/") ? path.substring(1) : path;

    const content = await import(
      `@repo/contents/${cleanPath}/_data/${locale}-material.ts`
    );

    const parsedContent = ExercisesMaterialListSchema.parse(content.default);

    return parsedContent;
  } catch {
    return [];
  }
}

/**
 * Gets the current material and item from the materials list.
 * @param path - The path to the material.
 * @param materials - The materials list.
 * @returns The current material and item.
 */
export function getCurrentMaterial(
  path: string,
  materials: ExercisesMaterialList
) {
  let currentMaterial: (typeof materials)[number] | undefined;
  let currentMaterialItem:
    | (typeof materials)[number]["items"][number]
    | undefined;

  for (const mat of materials) {
    const foundItem = mat.items.find(
      (itm) => cleanSlug(itm.href) === cleanSlug(path)
    );
    if (foundItem) {
      currentMaterial = mat;
      currentMaterialItem = foundItem;
      break;
    }
  }

  return { currentMaterial, currentMaterialItem };
}
