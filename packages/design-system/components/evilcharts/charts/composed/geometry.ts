/**
 * The rectangle one bar paints, from the geometry Recharts hands its shape.
 * Recharts measures a bar from its baseline to its value, so a value below the
 * baseline arrives with a negative height, which an SVG `rect` does not draw.
 * The bar keeps its place and its size: it starts at its upper edge and spans
 * the distance down. `baseline` is where the zero line crosses the bar, as a
 * share of its height from the top, so the bar grows out of it: the bottom of
 * a bar above zero, the top of a bar below it.
 */
export function barRectangle({
  height,
  width,
  x,
  y,
}: {
  readonly height: number;
  readonly width: number;
  readonly x: number;
  readonly y: number;
}) {
  if (height >= 0) {
    return { baseline: 1, height, width, x, y };
  }
  return { baseline: 0, height: -height, width, x, y: y + height };
}
