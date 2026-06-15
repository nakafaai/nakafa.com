import { getMaterialPath } from "@repo/contents/_lib/exercises/route";
import { listExercisePlans } from "@repo/contents/_types/plan/registry";
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
      const planMaterials = new Set(
        listExercisePlans()
          .filter((plan) => plan.category === category && plan.type === type)
          .map((plan) => plan.material)
      );

      return EXERCISES_MATERIALS.flatMap((material) => {
        if (!planMaterials.has(material)) {
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
