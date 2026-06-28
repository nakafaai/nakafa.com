import type {
  MaterialSource,
  PracticeMaterialSource,
} from "@repo/contents/_types/material/schema";
import type { RouteInputs } from "@repo/contents/_types/route/input";

/** Narrows unified material sources to practice material sources. */
export function isPracticeMaterialSource(
  material: MaterialSource
): material is PracticeMaterialSource {
  return material.kind === "practice";
}

/** Indexes practice materials by stable material key for assessment projection. */
export function createPracticeMaterialByKey(
  materials: NonNullable<RouteInputs["materials"]>
) {
  const entries: [PracticeMaterialSource["key"], PracticeMaterialSource][] = [];

  for (const material of materials) {
    if (isPracticeMaterialSource(material)) {
      entries.push([material.key, material]);
    }
  }

  return new Map(entries);
}
