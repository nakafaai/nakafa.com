import { getMaterialPath } from "@repo/contents/_lib/exercises/route";
import { listExerciseMaterials } from "@repo/contents/_types/material/registry";
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
  (category: ExercisesCategory, type: ExercisesType) =>
    Effect.sync(() => {
      const availableMaterials = new Set(
        listExerciseMaterials()
          .filter(
            (material) =>
              material.category === category && material.type === type
          )
          .map((material) => material.material)
      );

      return EXERCISES_MATERIALS.flatMap((material) => {
        if (!availableMaterials.has(material)) {
          return [];
        }

        return [
          {
            label: material,
            href: getMaterialPath(category, type, material),
          },
        ];
      });
    })
);
