import type { Shape } from "@repo/mascot/shape";
import { HashSet } from "effect";

/**
 * The SVG attributes that the DOM spells in capitals as React does. Motion keeps
 * the same list, but importing it would load Motion with every drawing.
 */
const CAMEL_CASE_ATTRIBUTES = HashSet.make(
  "baseFrequency",
  "diffuseConstant",
  "gradientTransform",
  "kernelMatrix",
  "kernelUnitLength",
  "keySplines",
  "keyTimes",
  "lengthAdjust",
  "limitingConeAngle",
  "markerHeight",
  "markerWidth",
  "numOctaves",
  "pathLength",
  "specularConstant",
  "specularExponent",
  "startOffset",
  "stdDeviation",
  "surfaceScale",
  "tableValues",
  "targetX",
  "targetY",
  "textLength",
  "viewBox"
);

/** A capital letter of a field name, which the DOM spells as a dash and the lower-case letter. */
const CAPITAL = /[A-Z]/gu;

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
  return HashSet.has(CAMEL_CASE_ATTRIBUTES, field)
    ? field
    : field.replace(CAPITAL, (letter) => `-${letter.toLowerCase()}`);
}
