import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import type {
  ExercisesMaterial,
  ExercisesMaterialList,
} from "@repo/contents/_types/exercises/material";
import { ExercisesMaterialListSchema } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";
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
