import { listPracticeMaterialSources } from "@repo/contents/_types/material/registry";
import type { ExercisesType } from "@repo/contents/_types/taxonomy";
import { EXERCISES_MATERIALS } from "@repo/contents/_types/taxonomy";
import { Effect } from "effect";

/**
 * Loads the material list for a given assessment type.
 *
 * @param type - Exercises type slug
 * @returns Material labels, or an empty array when unavailable
 */
export const getSubjects = Effect.fn("contents.exercises.getSubjects")(
  (type: ExercisesType) =>
    Effect.sync(() => {
      const availableMaterials = new Set(
        listPracticeMaterialSources()
          .filter((material) => material.assessment === type)
          .map((material) => material.domain)
      );

      return EXERCISES_MATERIALS.flatMap((material) => {
        if (!availableMaterials.has(material)) {
          return [];
        }

        return [
          {
            label: material,
          },
        ];
      });
    })
);
