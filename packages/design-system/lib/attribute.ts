import type { Shape } from "@repo/mascot/shape";
import { camelCaseAttributes, camelToDash } from "motion";

/**
 * What a shape sets on its element, by the name that React gives the attribute
 * (the name of the field): every field of the shape but its tag, its mark and
 * the shapes it holds. It is the one place that says which fields of a shape
 * are attributes. `Drawing` draws them through React and `paint` writes them
 * straight onto the elements, so the two cannot disagree.
 */
export function attributesOf<Mark>(
  shape: Shape<Mark>
): Readonly<Record<string, string | number | undefined>> {
  if (shape._tag === "g") {
    const { _tag, children, mark, ...attributes } = shape;
    return attributes;
  }
  const { _tag, mark, ...attributes } = shape;
  return attributes;
}

/**
 * The name that the DOM gives the attribute which a field sets. React writes it
 * in capitals (`strokeWidth`) and the DOM with a dash (`stroke-width`), except
 * for the few that the DOM spells with capitals too (`pathLength`).
 */
export function attributeName(field: string) {
  return camelCaseAttributes.has(field) ? field : camelToDash(field);
}
