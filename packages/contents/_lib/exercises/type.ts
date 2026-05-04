import {
  getCategoryPath,
  getMaterialPath,
} from "@repo/contents/_lib/exercises/route";
import { getFolderChildNamesSync } from "@repo/contents/_lib/fs";
import type { ExercisesCategory } from "@repo/contents/_types/exercises/category";
import { ExercisesMaterialSchema } from "@repo/contents/_types/exercises/material";
import type { ExercisesType } from "@repo/contents/_types/exercises/type";

const orderedMaterials = ExercisesMaterialSchema.options;

/**
 * Loads the material list for a given exercises category and type.
 *
 * @param category - Exercises category slug
 * @param type - Exercises type slug
 * @returns Material list with labels and href values, or an empty array when unavailable
 *
 * @example
 * ```ts
 * const subjects = getSubjects("high-school", "tka");
 * // Returns: [{ label: "mathematics", href: "/exercises/high-school/tka/mathematics" }, ...]
 * ```
 */
export function getSubjects(category: ExercisesCategory, type: ExercisesType) {
  const categoryPath = getCategoryPath(category);
  const typePath = `${categoryPath.slice(1)}/${type}`;
  const materialFolders = new Set(getFolderChildNamesSync(typePath));

  return orderedMaterials
    .filter((material) => materialFolders.has(material))
    .map((material) => ({
      label: material,
      href: getMaterialPath(category, type, material),
    }));
}
