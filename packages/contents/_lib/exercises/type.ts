import {
  getCategoryPath,
  getMaterialPath,
} from "@repo/contents/_lib/exercises/route";
import { getFolderChildNames } from "@repo/contents/_lib/fs/cache";
import type {
  ExercisesCategory,
  ExercisesType,
} from "@repo/contents/_types/taxonomy";
import { EXERCISES_MATERIALS } from "@repo/contents/_types/taxonomy";
import { Effect } from "effect";

/**
 * Loads the material list for a given exercises category and type.
 *
 * @param category - Exercises category slug
 * @param type - Exercises type slug
 * @returns Material list with labels and href values, or an empty array when unavailable
 *
 * @example
 * ```ts
 * const subjects = yield* getSubjects("high-school", "tka");
 * // Returns: [{ label: "mathematics", href: "/exercises/high-school/tka/mathematics" }, ...]
 * ```
 */
export const getSubjects = Effect.fn("contents.exercises.getSubjects")(
  function* (category: ExercisesCategory, type: ExercisesType) {
    const categoryPath = getCategoryPath(category);
    const typePath = `${categoryPath.slice(1)}/${type}`;
    const materialFolders = new Set(
      yield* getFolderChildNames(typePath).pipe(
        Effect.orElse(() => Effect.succeed([]))
      )
    );

    return EXERCISES_MATERIALS.flatMap((material) => {
      if (!materialFolders.has(material)) {
        return [];
      }

      return [
        {
          label: material,
          href: getMaterialPath(category, type, material),
        },
      ];
    });
  }
);
