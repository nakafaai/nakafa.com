/** A place on the plane a vector triangle is drawn in: to the right and up, as the learner sees it. */
type Spot = readonly [right: number, up: number];

/**
 * Where the label of one side of a vector triangle stands: at the middle of
 * the side, on the side of it that faces away from the triangle, held by
 * the edge of the label that is nearest the arrow. Every label then lies
 * outside the triangle and each on its own side of it, so no label covers
 * an arrow or another label, however thin the triangle is.
 *
 * @param from - Where the arrow starts
 * @param to - Where the arrow ends
 * @param inside - A place inside the triangle, such as the third corner
 */
export function besideArrow(from: Spot, to: Spot, inside: Spot) {
  const middle = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2] as const;
  const along = [to[0] - from[0], to[1] - from[1]] as const;
  const side =
    along[0] * (inside[1] - from[1]) - along[1] * (inside[0] - from[0]);
  // The normal of the arrow that points away from the inside.
  const away =
    side > 0
      ? ([along[1], -along[0]] as const)
      : ([-along[1], along[0]] as const);

  if (Math.abs(away[0]) > Math.abs(away[1])) {
    return {
      anchorX: away[0] > 0 ? "left" : "right",
      anchorY: "middle",
      middle,
    } as const;
  }
  return {
    anchorX: "center",
    anchorY: away[1] > 0 ? "bottom" : "top",
    middle,
  } as const;
}
