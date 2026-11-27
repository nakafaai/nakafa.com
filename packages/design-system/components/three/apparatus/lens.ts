/**
 * A close view: a small framed picture beside the apparatus that shows one
 * part of it magnified, as a textbook figure shows the meniscus of a
 * burette in a circle beside the whole burette. The view looks straight at
 * a point from in front, and shows a span of the subject from its bottom
 * edge to its top. Every length is in metres.
 */
export const LENS = {
  /** The view's field of view, top to bottom, in degrees: long, so the subject is seen nearly square on. */
  fov: 16,
  /** The frame's border, as a share of the picture's side. */
  frame: 0.05,
  /** The picture's side, in pixels. */
  pixels: 768,
} as const;

/**
 * Where the camera of a close view stands and how far it sees, for a view
 * that centres on `look` and shows `span` metres of the subject from its
 * bottom edge to its top.
 *
 * @param look - The point the view centres on
 * @param span - How much of the subject the view shows, top to bottom
 */
export function lensOf(look: readonly [number, number, number], span: number) {
  const distance = span / 2 / Math.tan(((LENS.fov / 2) * Math.PI) / 180);
  return {
    camera: [look[0], look[1], look[2] + distance] as const,
    far: distance * 4,
    near: distance / 4,
  };
}
