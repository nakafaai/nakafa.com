import type { Shape } from "@repo/mascot/shape";

/**
 * What a shape sets on its element, by the name that React gives the attribute
 * (the name of the field): every field of the shape but its tag, its mark and
 * the shapes it holds. It is the one place that says which fields of a shape
 * are attributes when `Drawing` draws them through React.
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
